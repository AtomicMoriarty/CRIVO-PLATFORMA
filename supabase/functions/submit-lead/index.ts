import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Recebe os formulários públicos (diagnóstico, proposta, parceria-contador),
// confere o token do Cloudflare Turnstile e só então grava o lead — usando o
// service role (que ignora a RLS). Por isso a validação dos campos é refeita
// aqui dentro: é a única barreira, já que a RLS não roda no service role.
const cors = {
  "Access-Control-Allow-Origin": "https://crivo-plataforma.heitorhllopes.workers.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ALLOWED_TIPOS = ["diagnostico", "proposta", "parceiro_contador"];
// Campos aceitos em public.leads (whitelist anti-injeção de colunas arbitrárias).
const TEXT_FIELDS: Record<string, number> = {
  source: 60, tipo: 40, nome: 200, email: 320, empresa: 200, cnpj: 20,
  telefone: 40, origem: 60, plano_interesse: 40, mensagem: 4000,
  crc: 40, escritorio: 200, canal_aquisicao: 120,
};

async function verifyTurnstile(token: string, ip: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  // Segurança de rollout: se a secret ainda não estiver configurada, não derruba
  // os formulários (libera). Com a secret setada, a verificação passa a valer.
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: "missing-token" };
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  return { ok: !!data.success, reason: (data["error-codes"] || []).join(",") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const payload = await req.json().catch(() => ({}));
    const token: string = payload?.token || "";
    const lead = payload?.lead || {};

    if (!ALLOWED_TIPOS.includes(lead?.tipo)) return json({ ok: false, error: "Tipo de formulário inválido." }, 200);

    const ip = req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const check = await verifyTurnstile(token, ip);
    if (!check.ok) {
      const msg = check.reason === "missing-token"
        ? "Verificação de segurança não concluída. Recarregue a página e tente novamente."
        : "Verificação de segurança falhou. Recarregue a página e tente novamente.";
      return json({ ok: false, error: msg }, 200);
    }

    // Monta o registro só com campos da whitelist, com teto de tamanho e status fixo.
    const row: Record<string, unknown> = { status: "novo" };
    for (const [field, max] of Object.entries(TEXT_FIELDS)) {
      const v = lead?.[field];
      if (v === undefined || v === null) continue;
      const s = String(v).slice(0, max);
      if (s.length) row[field] = s;
    }
    if (!row.source) row.source = String(lead?.tipo || "form");
    if (lead?.qtd_clientes_pj !== undefined) {
      const n = Number(lead.qtd_clientes_pj);
      row.qtd_clientes_pj = Number.isFinite(n) ? Math.max(0, Math.min(1_000_000, Math.trunc(n))) : 0;
    }
    if (!row.nome || String(row.email || "").indexOf("@") < 1) {
      return json({ ok: false, error: "Preencha nome e e-mail válidos." }, 200);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { error } = await supabase.from("leads").insert(row);
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: "Não foi possível registrar agora. Tente novamente em instantes." }, 200);
  }
});
