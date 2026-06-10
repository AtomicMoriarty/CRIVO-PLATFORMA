import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
    const { buyer_company_id, limit = 20 } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: buyer } = await supabase.from("companies").select("*").eq("id", buyer_company_id).maybeSingle();
    if (!buyer) return json({ error: "Empresa contratante não encontrada." }, 404);

    const { data: suppliers } = await supabase
      .from("companies")
      .select("*, scores(total, dim_documentacao, calculated_at)")
      .in("tipo", ["fornecedor", "ambos"])
      .eq("situacao_rfb", "ativa")
      .neq("id", buyer_company_id);

    const ranked = (suppliers || [])
      .map((supplier: any) => {
        const latest = [...(supplier.scores || [])].sort((a, b) => Date.parse(b.calculated_at) - Date.parse(a.calculated_at))[0];
        if (!latest || latest.total < 500) return null;
        let bonus = 0;
        const reasons: string[] = [];
        if (supplier.estado && supplier.estado === buyer.estado) { bonus += 80; reasons.push(`Mesmo estado (${supplier.estado})`); }
        if (supplier.segmento && supplier.segmento === buyer.segmento) { bonus += 50; reasons.push("Mesmo segmento"); }
        if (supplier.regime === "lucro_real") { bonus += 100; reasons.push("Regime compatível (Lucro Real)"); }
        if (supplier.regime === "lucro_presumido" && buyer.regime === "lucro_real") { bonus += 70; reasons.push("Regime compatível (Lucro Presumido)"); }
        if (latest.total >= 800) { bonus += 40; reasons.push(`Score excelente (${latest.total})`); }
        if (Number(latest.dim_documentacao) === 1000) { bonus += 20; reasons.push("Documentação completa"); }
        return { ...supplier, scores: undefined, latest_score: latest, match_score: Math.min(latest.total + bonus, 1000), match_reasons: reasons };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.match_score - a.match_score)
      .slice(0, limit);

    return json({ data: ranked });
  } catch (error) {
    return json({ error: String((error as any)?.message || error) }, 400);
  }
});
