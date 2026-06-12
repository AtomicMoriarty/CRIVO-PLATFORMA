import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const plan = body.plan || body.plano;
    const user_id = body.user_id || body.usuario_id;
    const success_url = body.success_url || "https://crivo-plataforma.heitorhllopes.workers.dev/painel?checkout=success";
    const cancel_url = body.cancel_url || "https://crivo-plataforma.heitorhllopes.workers.dev/planos?checkout=cancelled";
    const email = body.email;
    if (!["pro", "premium"].includes(plan)) return json({ error: "Plano inválido." }, 400);
    if (!user_id) return json({ error: "Usuário não identificado." }, 400);

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return json({ error: "Pagamentos ainda não configurados. Fale com contato@adeke.com.br." }, 503);

    const stripe = new Stripe(secret, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const price = plan === "pro" ? Deno.env.get("STRIPE_PRICE_PRO_ID") : Deno.env.get("STRIPE_PRICE_PREMIUM_ID");
    if (!price) return json({ error: `Preço do plano ${plan} não configurado.` }, 503);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      metadata: { user_id, plan },
      success_url,
      cancel_url,
    });

    return json({ url: session.url });
  } catch (error) {
    return json({ error: String((error as any)?.message || error) }, 400);
  }
});
