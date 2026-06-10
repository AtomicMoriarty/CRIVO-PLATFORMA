import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DOC_LABELS: Record<string, string> = {
  certidao_federal: "Certidão Federal",
  certidao_estadual: "Certidão Estadual",
  certidao_trabalhista: "Certidão Trabalhista",
  nf_referencia: "NF de Referência",
  contrato_social: "Contrato Social",
};

serve(async (req) => {
  try {
    const { company_id, cnpj, modo } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    let companyId = company_id;
    let company: any = null;

    if (!companyId && cnpj) {
      const clean = String(cnpj).replace(/\D/g, "");
      const { data: cached } = await supabase.from("companies").select("*").eq("cnpj", clean).maybeSingle();
      company = cached;
      if (!company) {
        const rfbRes = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`);
        const rfb = rfbRes.ok ? await rfbRes.json() : null;
        const payload = {
          cnpj: clean,
          razao_social: rfb?.razao_social || rfb?.estabelecimento?.nome_fantasia || `CNPJ ${clean}`,
          nome_fantasia: rfb?.estabelecimento?.nome_fantasia,
          tipo: "fornecedor",
          cnae_principal: rfb?.estabelecimento?.atividade_principal?.id || rfb?.atividade_principal?.id,
          cnae_descricao: rfb?.estabelecimento?.atividade_principal?.descricao || rfb?.atividade_principal?.descricao,
          estado: rfb?.estabelecimento?.estado?.sigla,
          municipio: rfb?.estabelecimento?.cidade?.nome,
          segmento: rfb?.atividade_principal?.descricao || rfb?.estabelecimento?.atividade_principal?.descricao,
          situacao_rfb: rfb?.estabelecimento?.situacao_cadastral === "Ativa" || rfb?.estabelecimento?.situacao_cadastral_id === 2 ? "ativa" : "ativa",
          data_abertura: rfb?.estabelecimento?.data_inicio_atividade,
          socios: rfb?.socios || [],
          raw_rfb: rfb || {},
        };
        const { data: inserted, error: insertCompanyError } = await supabase.from("companies").insert(payload).select().single();
        if (insertCompanyError) throw insertCompanyError;
        company = inserted;
      }
      companyId = company.id;
    }

    if (!company) {
      const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
      if (error) throw error;
      company = data;
    }

    const dim_regularidade = company.situacao_rfb === "ativa" ? 950 : company.situacao_rfb === "suspensa" ? 450 : 200;
    const dim_regime_cnae = company.regime === "lucro_real" ? 900 : company.regime === "lucro_presumido" ? 760 : company.regime === "simples" ? 620 : 520;

    const { data: docs } = await supabase.from("documents").select("tipo").eq("company_id", company_id).eq("status", "valid");
    const required = ["certidao_federal", "certidao_estadual", "certidao_trabalhista", "nf_referencia", "contrato_social"];
    const covered = required.filter((r) => docs?.some((d) => d.tipo === r)).length;
    const missing = required.filter((r) => !docs?.some((d) => d.tipo === r));
    const dim_documentacao = Math.round((covered / required.length) * 1000);

    const ageYears = company.data_abertura ? (Date.now() - new Date(company.data_abertura).getTime()) / (365.25 * 24 * 3600 * 1000) : 0;
    const dim_consistencia = ageYears >= 5 ? 850 : ageYears >= 2 ? 700 : ageYears >= 0.5 ? 550 : 300;
    const dim_contencioso = 650;
    const socios = Array.isArray(company.socios) ? company.socios : [];
    const dim_societario = socios.length ? 800 : 400;
    const dim_retencoes = 700;

    const total = Math.round(
      dim_regularidade * 0.35 +
        dim_regime_cnae * 0.30 +
        dim_documentacao * 0.15 +
        dim_consistencia * 0.10 +
        dim_contencioso * 0.05 +
        dim_societario * 0.03 +
        dim_retencoes * 0.02,
    );

    const explanation = {
      regularidade: { score: dim_regularidade, source: "Receita Federal", label: company.situacao_rfb },
      regime_cnae: { score: dim_regime_cnae, source: "Cadastro da empresa", label: company.regime },
      documentacao: {
        score: dim_documentacao,
        label: covered === required.length ? "Documentação completa" : `${covered} de ${required.length} documentos obrigatórios`,
        detail: missing.length ? `Pendentes: ${missing.map((m) => DOC_LABELS[m]).join(", ")}` : "Toda documentação obrigatória validada.",
        source: "documents table",
      },
      consistencia: { score: dim_consistencia, source: "data_abertura" },
      contencioso: { score: dim_contencioso, source: "placeholder" },
      societario: { score: dim_societario, source: "socios" },
      retencoes: { score: dim_retencoes, source: "placeholder" },
    };

    const { data: score, error: insertError } = await supabase
      .from("scores")
      .insert({
        company_id: companyId,
        version: "v2",
        total,
        dim_regularidade,
        dim_regime_cnae,
        dim_documentacao,
        dim_consistencia,
        dim_contencioso,
        dim_societario,
        dim_retencoes,
        explanation,
        sources_snapshot: { company },
      })
      .select()
      .single();
    if (insertError) throw insertError;
    return Response.json(modo === "preview" ? { ...score, company } : score);
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400 });
  }
});
