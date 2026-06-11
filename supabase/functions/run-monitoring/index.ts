import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// publica.cnpj.ws aceita ~3 consultas/min; processamos as empresas mais
// desatualizadas primeiro e o cron diário cobre o restante nas próximas execuções.
const MAX_COMPANIES = 10;
const RFB_DELAY_MS = 21000;

const DOC_LABELS: Record<string, string> = {
  certidao_federal: "CND Federal (PGFN/RFB)",
  crf_fgts: "CRF FGTS",
  certidao_estadual: "Certidão Estadual (SEFAZ)",
  certidao_municipal: "Certidão Municipal",
  certidao_trabalhista: "CNDT Trabalhista",
};

function mapSituacao(raw: unknown): string | null {
  const s = String(raw || "").toLowerCase();
  if (["ativa", "suspensa", "inapta", "baixada"].includes(s)) return s;
  if (s === "nula") return "baixada";
  return null;
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

  const { data: portfolios } = await supabase.from("portfolios").select("supplier_id").eq("status", "active");
  const ids = [...new Set((portfolios || []).map((p) => p.supplier_id))];
  if (!ids.length) return Response.json({ processed: 0, alerts_created: 0 });

  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .in("id", ids)
    .order("updated_at", { ascending: true })
    .limit(MAX_COMPANIES);

  let alertsCreated = 0;

  // Não duplica um alerta do mesmo tipo criado nos últimos 7 dias e ainda não resolvido.
  async function createAlert(alert: { company_id: string; tipo: string; severity: string; title: string; description: string }) {
    const { data: existing } = await supabase
      .from("alerts")
      .select("id")
      .eq("company_id", alert.company_id)
      .eq("tipo", alert.tipo)
      .eq("resolved", false)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(1);
    if (existing?.length) return false;
    const { error } = await supabase.from("alerts").insert(alert);
    if (!error) alertsCreated++;
    return !error;
  }

  // Notifica donos da empresa monitorada + usuários dos contratantes que a têm na carteira.
  async function notify(company: any, alert: { title: string; description: string; severity: string }) {
    const userIds = new Set<string>();
    const { data: owners } = await supabase.from("company_users").select("user_id").eq("company_id", company.id);
    owners?.forEach((o) => o.user_id && userIds.add(o.user_id));
    const { data: buyers } = await supabase.from("portfolios").select("buyer_id").eq("supplier_id", company.id).eq("status", "active");
    for (const b of buyers || []) {
      const { data: us } = await supabase.from("company_users").select("user_id").eq("company_id", b.buyer_id);
      us?.forEach((u) => u.user_id && userIds.add(u.user_id));
    }
    for (const id of userIds) {
      try {
        const { data } = await supabase.auth.admin.getUserById(id);
        const email = data?.user?.email;
        if (!email) continue;
        await supabase.functions.invoke("send-alert-email", {
          body: { email, company_name: company.razao_social, alert_title: alert.title, description: alert.description, severity: alert.severity },
        });
      } catch (_) {
        // E-mail é best-effort; o alerta in-app permanece registrado.
      }
    }
  }

  for (const company of companies || []) {
    if (!company?.cnpj) continue;

    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${company.cnpj.replace(/\D/g, "")}`);
      if (res.ok) {
        const rfb = await res.json();
        const newStatus = mapSituacao(rfb?.estabelecimento?.situacao_cadastral);
        if (newStatus && newStatus !== company.situacao_rfb) {
          await supabase
            .from("companies")
            .update({ situacao_rfb: newStatus, raw_rfb: rfb, updated_at: new Date().toISOString() })
            .eq("id", company.id);
          const alert = {
            company_id: company.id,
            tipo: "rfb_irregular",
            severity: newStatus === "ativa" ? "medium" : "critical",
            title: "Situação RFB alterada",
            description: `Situação mudou de "${company.situacao_rfb}" para "${newStatus}". ${newStatus === "ativa" ? "Empresa regularizada." : "Risco elevado de glosa de crédito."}`,
          };
          if (await createAlert(alert)) await notify(company, alert);
          company.situacao_rfb = newStatus;
        } else {
          await supabase.from("companies").update({ updated_at: new Date().toISOString() }).eq("id", company.id);
        }
      }
    } catch (_) {
      // Falha de rede ou rate limit: a próxima execução agendada tenta de novo.
    }

    await supabase.functions.invoke("calculate-score", { body: { company_id: company.id, force: true } });
    const { data: scores } = await supabase
      .from("scores")
      .select("total")
      .eq("company_id", company.id)
      .order("calculated_at", { ascending: false })
      .limit(2);
    if (scores?.length === 2 && Number(scores[0].total) < Number(scores[1].total) - 100) {
      const delta = Number(scores[1].total) - Number(scores[0].total);
      const alert = {
        company_id: company.id,
        tipo: "score_drop",
        severity: "high",
        title: `Score caiu ${delta} pontos`,
        description: `Score anterior: ${scores[1].total}. Score atual: ${scores[0].total}. Verifique as dimensões afetadas.`,
      };
      if (await createAlert(alert)) await notify(company, alert);
    }

    const { data: docs } = await supabase
      .from("documents")
      .select("tipo, valid_until")
      .eq("company_id", company.id)
      .eq("status", "valid")
      .lte("valid_until", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    for (const doc of docs || []) {
      const days = Math.max(0, Math.ceil((Date.parse(doc.valid_until) - Date.now()) / 86400000));
      const alert = {
        company_id: company.id,
        tipo: "certidao_expiring",
        severity: "medium",
        title: days > 0 ? `Certidão vence em ${days} dias` : "Certidão vencida",
        description: `${DOC_LABELS[doc.tipo] || doc.tipo} válida até ${doc.valid_until}.`,
      };
      if (await createAlert(alert)) await notify(company, alert);
    }

    await sleep(RFB_DELAY_MS);
  }

  return Response.json({ processed: companies?.length || 0, alerts_created: alertsCreated });
});
