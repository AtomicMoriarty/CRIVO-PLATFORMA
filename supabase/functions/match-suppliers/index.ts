import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

serve(async (req) => {
  try {
    const { buyer_company_id, limit = 20 } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: buyer } = await supabase.from("companies").select("*").eq("id", buyer_company_id).single();
    const { data: suppliers } = await supabase
      .from("companies")
      .select("*, scores(*)")
      .in("tipo", ["fornecedor", "ambos"])
      .eq("situacao_rfb", "ativa");

    const ranked = (suppliers || [])
      .map((supplier: any) => {
        const latest = [...(supplier.scores || [])].sort((a, b) => Date.parse(b.calculated_at) - Date.parse(a.calculated_at))[0];
        if (!latest || latest.total < 500) return null;
        let bonus = 0;
        const reasons: string[] = [];
        if (supplier.estado === buyer.estado) { bonus += 80; reasons.push(`Mesmo estado (${supplier.estado})`); }
        if (supplier.segmento === buyer.segmento) { bonus += 50; reasons.push("Mesmo segmento"); }
        if (supplier.regime === "lucro_real") { bonus += 100; reasons.push("Regime compatível (Lucro Real)"); }
        if (supplier.regime === "lucro_presumido" && buyer.regime === "lucro_real") { bonus += 70; reasons.push("Regime compatível (Lucro Presumido)"); }
        if (latest.total >= 800) { bonus += 40; reasons.push(`Score excelente (${latest.total})`); }
        if (latest.dim_documentacao === 1000) { bonus += 20; reasons.push("Documentação completa"); }
        return { ...supplier, latest_score: latest, match_score: Math.min(latest.total + bonus, 1000), match_reasons: reasons };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.match_score - a.match_score)
      .slice(0, limit);

    return Response.json({ data: ranked });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400 });
  }
});
