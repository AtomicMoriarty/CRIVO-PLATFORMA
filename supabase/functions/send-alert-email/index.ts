import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BASE = Deno.env.get("CRIVO_APP_URL") || "https://crivo-plataforma.heitorhllopes.workers.dev";

serve(async (req) => {
  try {
    const { email, company_name, alert_title, description, severity } = await req.json();
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");
    const color = severity === "critical" ? "#E05252" : severity === "high" ? "#E0913A" : "#C8963A";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;padding:0;background:#EEF0F3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F3;padding:24px 12px;">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E5EA;">
            <tr><td style="background:#0A1420;padding:22px 28px;" align="center">
              <img src="${BASE}/assets/email-icon.png" width="52" height="52" alt="Crivo" style="display:block;margin:0 auto 8px;border-radius:50%;border:0;" />
              <div style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#F4F0E8;line-height:1;">Crivo<span style="color:#C8963A;">.</span></div>
            </td></tr>
            <tr><td style="padding:26px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#0A1420;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 14px;">Detectamos uma mudança em <strong>${company_name}</strong>:</p>
              <div style="border-left:4px solid ${color};padding:12px 14px;background:#F6F7F9;border-radius:0 8px 8px 0;">
                <strong style="color:#0A1420;">${alert_title}</strong>
                <p style="margin:6px 0 0;color:#33414F;">${description || ""}</p>
              </div>
            </td></tr>
            <tr><td style="padding:20px 28px 26px;">
              <a href="${BASE}/dashboard" style="display:inline-block;background:#C8963A;color:#0A1420;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:11px 20px;border-radius:8px;">Ver detalhes no Crivo</a>
            </td></tr>
            <tr><td style="background:#F6F7F9;border-top:1px solid #E2E5EA;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#7A8696;">
              Crivo by Adeke · Monitoramento diário de conformidade fiscal.<br />
              O Score Crivo é um indicador estatístico e não constitui parecer jurídico.
            </td></tr>
          </table>
        </td></tr>
      </table></body></html>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Crivo <onboarding@resend.dev>",
        to: [email],
        subject: `Alerta Crivo: ${company_name} — ${alert_title}`,
        html,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400 });
  }
});
