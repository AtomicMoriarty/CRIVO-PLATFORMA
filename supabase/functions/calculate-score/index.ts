import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DOC_LABELS: Record<string, string> = {
  certidao_federal: "CND Federal (PGFN)",
  certidao_estadual: "Certidão Estadual (SEFAZ)",
  certidao_trabalhista: "CNDT Trabalhista",
  nf_referencia: "Notas Fiscais (3 meses)",
  contrato_social: "Contrato Social",
};
const REQUIRED_DOCS = Object.keys(DOC_LABELS);

const CNAE_INDUSTRY = ["10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33"];

// publica.cnpj.ws devolve "Ativa" | "Suspensa" | "Inapta" | "Baixada" | "Nula"
function mapSituacao(raw: unknown): string | null {
  const s = String(raw || "").toLowerCase();
  if (["ativa", "suspensa", "inapta", "baixada"].includes(s)) return s;
  if (s === "nula") return "baixada";
  return s ? "suspensa" : null;
}

function calcRegularidade(situacao: string | null) {
  if (situacao === "ativa") return { score: 950, label: "Ativa na Receita Federal", detail: "CNPJ em situação regular, sem irregularidades identificadas na base da Receita Federal." };
  if (situacao === "suspensa") return { score: 300, label: "Suspensa na Receita Federal", detail: "CNPJ com situação suspensa — risco alto de glosa de crédito CBS/IBS (Art. 47, LC 214/2025)." };
  if (situacao === "inapta") return { score: 50, label: "Inapta na Receita Federal", detail: "CNPJ inapto — a lei veda o aproveitamento de crédito pelo tomador." };
  if (situacao === "baixada") return { score: 0, label: "CNPJ Baixado", detail: "Empresa baixada — nenhum crédito CBS/IBS aproveitável." };
  return { score: 500, label: "Situação não verificada", detail: "Não foi possível verificar a situação na Receita Federal." };
}

function calcRegimeCnae(regime: string | null, cnae: string | null) {
  const cnae2 = String(cnae || "").replace(/\D/g, "").slice(0, 2);
  if (regime === "lucro_real") return { score: 900, label: "Lucro Real — potencial de crédito integral", detail: "Empresas no Lucro Real têm o maior potencial de geração e aproveitamento de créditos CBS/IBS." };
  if (regime === "lucro_presumido" && CNAE_INDUSTRY.includes(cnae2)) return { score: 820, label: "Lucro Presumido (indústria) — crédito relevante", detail: "Indústrias no Lucro Presumido geram crédito IBS sobre insumos." };
  if (regime === "lucro_presumido") return { score: 780, label: "Lucro Presumido — crédito parcial", detail: "Empresas no Lucro Presumido geram crédito CBS restrito. Verifique a alíquota efetiva." };
  if (regime === "simples" && CNAE_INDUSTRY.includes(cnae2)) return { score: 550, label: "Simples Nacional (indústria) — crédito restrito", detail: "Industriais no Simples: crédito CBS/IBS limitado à alíquota efetiva de recolhimento." };
  if (regime === "simples") return { score: 600, label: "Simples Nacional — crédito limitado", detail: "Optantes do Simples geram crédito proporcional à alíquota efetiva." };
  if (regime === "mei") return { score: 150, label: "MEI — crédito muito limitado", detail: "MEIs não recolhem CBS/IBS separadamente. Aproveitamento pelo tomador é muito restrito." };
  return { score: 500, label: "Compatibilidade não determinada", detail: "Regime ou CNAE não identificados. Complete o cadastro da empresa." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { company_id, cnpj, modo, force } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    let companyId = company_id;
    let company: any = null;

    if (!companyId && cnpj) {
      const clean = String(cnpj).replace(/\D/g, "");
      const { data: cached } = await supabase.from("companies").select("*").eq("cnpj", clean).maybeSingle();
      company = cached;
      if (!company) {
        const rfbRes = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`);
        if (rfbRes.status === 429) return json({ error: "Limite de consultas à Receita atingido. Aguarde 1 minuto e tente novamente." }, 429);
        const rfb = rfbRes.ok ? await rfbRes.json() : null;
        if (!rfb?.razao_social) return json({ error: "CNPJ não encontrado na Receita Federal." }, 404);
        const regime = rfb?.simples?.mei === "Sim" ? "mei" : rfb?.simples?.simples === "Sim" ? "simples" : null;
        const payload = {
          cnpj: clean,
          razao_social: rfb.razao_social,
          nome_fantasia: rfb?.estabelecimento?.nome_fantasia || null,
          tipo: "fornecedor",
          regime,
          cnae_principal: String(rfb?.estabelecimento?.atividade_principal?.id || ""),
          cnae_descricao: rfb?.estabelecimento?.atividade_principal?.descricao || null,
          estado: rfb?.estabelecimento?.estado?.sigla || null,
          municipio: rfb?.estabelecimento?.cidade?.nome || null,
          segmento: rfb?.estabelecimento?.atividade_principal?.descricao || null,
          situacao_rfb: mapSituacao(rfb?.estabelecimento?.situacao_cadastral) || "ativa",
          data_abertura: rfb?.estabelecimento?.data_inicio_atividade || null,
          capital_social: Number(rfb?.capital_social) || null,
          socios: (rfb?.socios || []).map((s: any) => ({ nome: s?.nome, qual: s?.qualificacao_socio?.descricao || s?.qual })),
          raw_rfb: rfb,
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

    // Cache de 24h: evita acumular linhas idênticas a cada abertura de modal.
    if (!force) {
      const { data: recent } = await supabase
        .from("scores")
        .select("*")
        .eq("company_id", companyId)
        .gte("calculated_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) return json(modo === "preview" ? { ...recent, company } : recent);
    }

    const reg = calcRegularidade(company.situacao_rfb);
    const rc = calcRegimeCnae(company.regime, company.cnae_principal);

    const { data: docs } = await supabase.from("documents").select("tipo").eq("company_id", companyId).eq("status", "valid");
    const covered = REQUIRED_DOCS.filter((r) => docs?.some((d) => d.tipo === r)).length;
    const missing = REQUIRED_DOCS.filter((r) => !docs?.some((d) => d.tipo === r));
    const dim_documentacao = Math.round((covered / REQUIRED_DOCS.length) * 1000);

    const ageYears = company.data_abertura ? (Date.now() - new Date(company.data_abertura).getTime()) / (365.25 * 24 * 3600 * 1000) : 0;
    const cons = ageYears >= 5
      ? { score: 850, label: "Histórico consolidado (5+ anos)", detail: "Empresa com histórico operacional sólido, indicando consistência de emissão fiscal." }
      : ageYears >= 2
      ? { score: 700, label: "Empresa em crescimento (2–5 anos)", detail: "Empresa em fase de consolidação do histórico fiscal." }
      : ageYears >= 0.5
      ? { score: 550, label: "Empresa recente (6 meses – 2 anos)", detail: "Empresa recente — histórico fiscal ainda limitado." }
      : { score: 300, label: "Empresa muito recente (< 6 meses)", detail: "Empresa constituída há menos de 6 meses. Risco de inconsistência de emissão." };

    const socios = Array.isArray(company.socios) ? company.socios : [];
    const dim_contencioso = 650;
    const dim_societario = socios.length ? 800 : 400;
    const dim_retencoes = 700;

    const total = Math.round(
      reg.score * 0.35 +
        rc.score * 0.30 +
        dim_documentacao * 0.15 +
        cons.score * 0.10 +
        dim_contencioso * 0.05 +
        dim_societario * 0.03 +
        dim_retencoes * 0.02,
    );

    const explanation = {
      regularidade: { ...reg, source: "Receita Federal", fundamento: "Art. 47, LC 214/2025" },
      regime_cnae: { ...rc, source: "Cadastro da empresa", fundamento: "Art. 36, LC 214/2025" },
      documentacao: {
        score: dim_documentacao,
        label: covered === REQUIRED_DOCS.length ? "Documentação completa" : `${covered} de ${REQUIRED_DOCS.length} documentos obrigatórios`,
        detail: missing.length ? `Pendentes: ${missing.map((m) => DOC_LABELS[m]).join(", ")}` : "Toda documentação obrigatória validada.",
        source: "Documentos Crivo",
      },
      consistencia: { ...cons, source: "Data de abertura (Receita Federal)" },
      contencioso: { score: dim_contencioso, label: "Em implementação", detail: "Integração com tribunais federais e estaduais em desenvolvimento.", source: "placeholder" },
      societario: {
        score: dim_societario,
        label: socios.length ? `Quadro societário identificado (${socios.length} sócio${socios.length > 1 ? "s" : ""})` : "Quadro societário não informado",
        detail: socios.length ? "Sócios identificados via Receita Federal." : "Nenhum sócio identificado. Envie o contrato social para validação.",
        source: "Receita Federal",
      },
      retencoes: { score: dim_retencoes, label: "Análise situacional", detail: "Cálculo de retenções aplicáveis (IRRF, PCC, ISS) mediante configuração da operação específica.", source: "placeholder" },
    };

    const { data: score, error: insertError } = await supabase
      .from("scores")
      .insert({
        company_id: companyId,
        version: "v2",
        total,
        dim_regularidade: reg.score,
        dim_regime_cnae: rc.score,
        dim_documentacao,
        dim_consistencia: cons.score,
        dim_contencioso,
        dim_societario,
        dim_retencoes,
        explanation,
        sources_snapshot: {
          situacao_rfb: company.situacao_rfb,
          regime: company.regime,
          cnae_principal: company.cnae_principal,
          docs_validos: covered,
        },
      })
      .select()
      .single();
    if (insertError) throw insertError;
    return json(modo === "preview" ? { ...score, company } : score);
  } catch (error) {
    return json({ error: String((error as any)?.message || error) }, 400);
  }
});
