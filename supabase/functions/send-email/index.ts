import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { nome, email, subject, body } = await req.json();
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");

    const html = `<p>Olá ${nome || ""},</p><p>${body || "Recebemos sua solicitação. Nossa equipe entrará em contato em até 2 dias úteis."}</p>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Crivo <onboarding@resend.dev>",
        to: [email],
        subject: subject || "✓ Diagnóstico solicitado — Crivo",
        html,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400, headers: cors });
  }
});
