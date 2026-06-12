import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const sig = req.headers.get("stripe-signature") || "";
  const body = await req.text();

  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
    );
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan;
      const userId = session.metadata?.user_id;
      const validPlans = ["pro", "premium"];
      if (userId && validPlans.includes(plan || "")) {
        await supabase.from("profiles").update({ plan }).eq("id", userId);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(String(sub.customer));
      if (!customer.deleted && customer.email) {
        const { data } = await supabase.from("profiles").select("id").eq("email", customer.email).maybeSingle();
        if (data?.id) await supabase.from("profiles").update({ plan: "free" }).eq("id", data.id);
      }
    }

    return new Response("ok");
  } catch (error) {
    return new Response(String(error?.message || error), { status: 400 });
  }
});
