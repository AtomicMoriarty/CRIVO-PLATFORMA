import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const { data: portfolios } = await supabase.from("portfolios").select("supplier_id").eq("status", "active");
  const ids = [...new Set((portfolios || []).map((p) => p.supplier_id))];
  const alerts = [];

  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    for (const company_id of batch) {
      const { data: company } = await supabase.from("companies").select("*").eq("id", company_id).single();
      if (!company?.cnpj) continue;

      try {
        const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${company.cnpj.replace(/\D/g, "")}`);
        const rfb = await res.json();
        const newStatus = String(rfb.situacao || "").toLowerCase();
        if (newStatus && newStatus !== company.situacao_rfb) {
          await supabase.from("companies").update({ situacao_rfb: newStatus, raw_rfb: rfb, updated_at: new Date().toISOString() }).eq("id", company_id);
          const alert = {
            company_id,
            tipo: "rfb_irregular",
            severity: "critical",
            title: "Situação RFB alterada",
            description: `Situação mudou de "${company.situacao_rfb}" para "${newStatus}". Risco elevado de glosa de crédito.`,
          };
          await supabase.from("alerts").insert(alert);
          alerts.push(alert);
        }
      } catch (_) {
        // ReceitaWS may rate-limit; next scheduled run retries.
      }

      await supabase.functions.invoke("calculate-score", { body: { company_id } });
      const { data: scores } = await supabase.from("scores").select("*").eq("company_id", company_id).order("calculated_at", { ascending: false }).limit(2);
      if (scores?.length === 2 && Number(scores[0].total) < Number(scores[1].total) - 100) {
        await supabase.from("alerts").insert({
          company_id,
          tipo: "score_drop",
          severity: "high",
          title: `Score caiu ${Number(scores[1].total) - Number(scores[0].total)} pontos`,
          description: `Score anterior: ${scores[1].total}. Score atual: ${scores[0].total}. Verifique as dimensões afetadas.`,
        });
      }

      const { data: docs } = await supabase.from("documents").select("*").eq("company_id", company_id).eq("status", "valid").lte("valid_until", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      for (const doc of docs || []) {
        await supabase.from("alerts").insert({
          company_id,
          tipo: "certidao_expiring",
          severity: "medium",
          title: "Certidão vence em breve",
          description: `${doc.tipo} válida até ${doc.valid_until}.`,
        });
      }
    }
    await sleep(2000);
  }

  return Response.json({ processed: ids.length, alerts_created: alerts.length });
});
