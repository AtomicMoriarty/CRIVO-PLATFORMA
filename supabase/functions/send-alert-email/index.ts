import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    const { email, company_name, alert_title, description, severity } = await req.json();
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");
    const color = severity === "critical" ? "#922B21" : severity === "high" ? "#E67E22" : "#D4AC0D";
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#0D1B2A">
        <h2>Crivo</h2><div style="height:2px;background:#D4AC0D"></div>
        <p>Detectamos uma mudança em <strong>${company_name}</strong>:</p>
        <div style="border-left:4px solid ${color};padding:12px;background:#f8fafc">
          <strong>${alert_title}</strong><p>${description || ""}</p>
        </div>
        <p><a style="background:#D4AC0D;color:#0D1B2A;padding:10px 14px;text-decoration:none;border-radius:6px" href="${Deno.env.get("CRIVO_APP_URL") || "https://crivo.pages.dev"}/dashboard/alertas">Ver detalhes no Crivo →</a></p>
      </div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Crivo <onboarding@resend.dev>",
        to: [email],
        subject: `⚠ Alerta Crivo: ${company_name} — ${alert_title}`,
        html,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400 });
  }
});
