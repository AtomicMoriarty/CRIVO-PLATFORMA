import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Endereço-base do site (para o logo e links). Mesma convenção do send-alert-email.
const BASE = Deno.env.get("CRIVO_APP_URL") || "https://crivo-plataforma.heitorhllopes.workers.dev";

// Cabeçalho de marca à prova de bloqueio: o logo é uma imagem hospedada no site,
// mas o nome "Crivo." é texto serif — se o cliente de e-mail bloquear imagens,
// a marca textual continua aparecendo. Tabelas + estilo inline = padrão de e-mail.
function brandedEmail(nome: string, bodyHtml: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;padding:0;background:#EEF0F3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E5EA;">
        <tr><td style="background:#0A1420;padding:24px 28px;" align="center">
          <img src="${BASE}/assets/email-icon.png" width="56" height="56" alt="Crivo"
               style="display:block;margin:0 auto 8px;border-radius:50%;border:0;outline:none;" />
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#F4F0E8;line-height:1;">
            Crivo<span style="color:#C8963A;">.</span>
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#C8963A;margin-top:6px;">
            Inteligência fiscal de fornecedores
          </div>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#0A1420;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 14px;">Olá ${nome || ""},</p>
          <div style="color:#33414F;">${bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:20px 28px 26px;">
          <a href="${BASE}" style="display:inline-block;background:#C8963A;color:#0A1420;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:11px 20px;border-radius:8px;">Acessar o Crivo</a>
        </td></tr>
        <tr><td style="background:#F6F7F9;border-top:1px solid #E2E5EA;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#7A8696;">
          Crivo by Adeke · Porto &amp; Pacca Advogados · contato@adeke.com.br<br />
          O Score Crivo é um indicador estatístico de aderência tributária e não constitui parecer jurídico.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { nome, email, subject, body } = await req.json();
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");

    const bodyHtml = `<p style="margin:0;">${body || "Recebemos sua solicitação. Nossa equipe entrará em contato em até 2 dias úteis."}</p>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Crivo <onboarding@resend.dev>",
        to: [email],
        subject: subject || "Diagnóstico solicitado — Crivo",
        html: brandedEmail(nome, bodyHtml),
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400, headers: cors });
  }
});
