import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

serve(async (req) => {
  try {
    const body = await req.json();
    const plan = body.plan || body.plano;
    const user_id = body.user_id || body.usuario_id;
    const success_url = body.success_url;
    const cancel_url = body.cancel_url;
    const email = body.email;
    if (!["pro", "premium"].includes(plan)) throw new Error("Invalid plan");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const price =
      plan === "pro" ? Deno.env.get("STRIPE_PRICE_PRO_ID") : Deno.env.get("STRIPE_PRICE_PREMIUM_ID");
    if (!price) throw new Error(`Missing Stripe price for ${plan}`);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      metadata: { user_id, plan },
      success_url,
      cancel_url,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400 });
  }
});
