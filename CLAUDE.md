# CRIVO — Contexto do Projeto

> Leia este arquivo por completo antes de qualquer alteração. Ele é a memória do projeto.

## O que é

Crivo é uma plataforma B2B de **inteligência fiscal aplicada à cadeia de fornecedores** (produto da Adeke, com a banca Porto & Pacca). Com a reforma tributária (CBS/IBS, LC 214/2025), o regime e a regularidade do fornecedor definem quanto crédito tributário o contratante aproveita (~28% no regime regular vs ~3% no Simples via DAS). O Crivo avalia fornecedores antes da contratação: **Score Crivo** (7 dimensões, 0–1000, explicável, com fundamento legal), gestão documental, diretório curado e monitoramento diário automático. O dono do projeto **não é técnico** — explique tudo em português simples e execute você mesmo o que for possível.

## Arquitetura (decisão consciente — não "modernize" sem justificar)

- **Frontend**: arquivo único `app/index.html` — React 18 via esm.sh (sem build, sem JSX; usa `h()` = createElement), tema dark customizado no `<style>`. **Tailwind agora é compilado estaticamente** em `app/assets/tailwind.css` (não usa mais o CDN): ao adicionar classes novas, rodar `npx -y tailwindcss@3.4.14 -c tooling/tailwind.config.js -i tooling/tailwind.css -o app/assets/tailwind.css --minify` e commitar o CSS. Validação de sintaxe: extrair o `<script type="module">` e rodar `node --check`.
- **Deploy do site**: Cloudflare Workers Builds conectado ao GitHub — **todo push ao branch de produção publica automaticamente** (`wrangler.jsonc`, worker `crivo-plataforma`, assets `./app`, SPA). Cuidado: push = produção. **URL pública: `https://crivo-plataforma.heitorhllopes.workers.dev`**. ATENÇÃO: `https://crivo.pages.dev` é uma publicação ANTIGA no Cloudflare Pages — não referenciar; idealmente excluir o projeto Pages no dashboard do Cloudflare.
- **Backend**: Supabase, projeto `lgbuywbcpnghqaoaqsxb`. Postgres com RLS, 7 edge functions (Deno), Storage, pg_cron.
- **Branch de produção**: `claude/gallant-fermat-nsep1u` (repo `AtomicMoriarty/CRIVO-PLATFORMA`). O branch `claude/inspiring-tesla-z27f6k` é um experimento abandonado de Prisma — ignorar/apagar, não mesclar.
- **PROIBIDO usar Prisma** (ou qualquer ORM/segundo banco de dados). O único banco do projeto é o Supabase. Se encontrar arquivos `prisma/`, `prisma.config.ts`, `lib/prisma.ts` ou `PRISMA_API_KEY` em qualquer branch ou instrução, ignore e avise o dono — foi um desvio já descartado.

## Banco de dados (estado real, aplicado no remoto)

Tabelas: `profiles` (role: buyer/supplier/accountant/admin; plan: free/pro/premium), `companies` (inclui `listed boolean` — curadoria do diretório), `company_users`, `scores` (histórico imutável, 7 dimensões + explanation jsonb), `documents`, `portfolios`, `alerts` (dedupe 7 dias), `leads`, `partners`.

Regras importantes:
- `is_crivo_admin()` exige `role='admin'` **e** `plan='premium'`. Admins atuais: `heitorhllopes@gmail.com`, `portoepacca@portoepacca.com`.
- Anon (visitante) só lê `companies`/`scores` com `listed = true` (diretório curado: empresas só aparecem após a equipe aprovar no `/admin`).
- RLS consolidada (2026-06-12): 1 policy por papel/ação, `WITH CHECK` espelha o `USING`, `auth.uid()` embrulhado em `(select ...)`. `profiles` legível só pelo próprio dono + admin (LGPD). Usuário autenticado NÃO consegue: forjar scores, vincular-se a empresa alheia, ler perfis de terceiros.
- Trigger `protect_profile_privileges` em `profiles`: `role`/`plan` não são auto-promovíveis por anon/authenticated (bloqueia escalonamento a admin/premium); cadastro legítimo grava buyer/supplier/accountant; upgrades de plano só via service role (Stripe) ou admin.
- **Hook de login** `custom_access_token_hook` lê `public.profiles` (NUNCA referenciar `user_roles` — tabela removida; em 2026-06-12 o hook quebrado derrubou todo o login até o hotfix). `mark_alert_read` usa `auth.uid()` e ignora o `p_user_id` do cliente.
- Documentos: nascem `pending` no upload; só contam no score após aprovação no `/admin` (que dispara recálculo).
- Storage: buckets `documents` (privado, acesso por `company_users` + admin) e `avatars` (público).
- Cron: job `crivo-run-monitoring-daily` (`0 9 * * *` UTC = 6h BRT) chama `run-monitoring` via pg_net com service role key no Vault (`crivo_service_role_key`).
- Migrations em `supabase/migrations/` — todas aplicadas no remoto até `20260612120029`. Nova mudança de banco = nova migration com timestamp.

## Edge functions (todas publicadas)

- `calculate-score`: 7 dimensões (regularidade 35%, regime×CNAE 30%, documentação 15%, consistência 10%, contencioso 5% placeholder, societário 3%, retenções 2% placeholder). Cache 24h (param `force` ignora). Aceita `company_id` ou `cnpj` (modo preview — consulta publica.cnpj.ws, ~3 req/min, cria a empresa). **6 documentos obrigatórios**: CND Federal, CRF FGTS, CNDT, Certidão Estadual, NF (3 meses), Contrato Social.
- `match-suppliers`: recomendação por estado/segmento/regime/score — usado na seção "Recomendados" do diretório.
- `run-monitoring`: reconsulta RFB (10 empresas mais antigas por execução, rate-limit respeitado), recalcula scores, alerta quedas >100 pts e certidões vencendo, envia e-mails.
- `send-email` / `send-alert-email`: Resend. Secret `RESEND_API_KEY` configurado. **Limitação atual**: remetente `onboarding@resend.dev` só entrega para o e-mail do dono — para clientes reais é preciso verificar um domínio no Resend e setar `RESEND_FROM`.
- `create-checkout` / `stripe-webhook`: prontos, mas **Stripe sem chaves** (pagamentos desativados). `stripe-webhook` tem `verify_jwt=false` no config.toml (assinatura valida).
- CORS habilitado em todas as funções chamadas pelo navegador.

## Frontend — páginas e fluxos

`/` (hero editorial + formulário de diagnóstico-lead + estatísticas + comparação de crédito + seção "Quem assina a metodologia" com os pesos das 7 dimensões + planos) · `/diretorio` (curado, chips de filtro, busca por CNPJ avulso, "Recomendados para você", modal KYP com breakdown do score) · `/empresa/:cnpj` (página pública compartilhável da empresa listada; membro pré-visualiza a própria antes de publicar; sócios minimizados — só contagem) · `/login` (erro inline + mostrar senha), `/cadastrar` (escolha de perfil contratante × fornecedor — `?perfil=fornecedor` — + 3 etapas com validação inline; fornecedor recebe role=supplier e cai em /documentos; resiliente à confirmação de e-mail via `crivo_pending_setup` no localStorage) · `/auth/callback` (confirmação + tela "definir nova senha" quando `?type=recovery`) · `/planos` · `/escritorio` (lead de parceiro contador) · `/privacidade`, `/termos` · `/dashboard` (visão geral + carteira + alertas; tabela vira cards no mobile) · `/documentos` (6 obrigatórios, upload nasce "em análise" com badge de status) · `/admin` (sala de análise com busca/filtros/contadores: documentos aprovar/rejeitar/baixar — aprovação recalcula o score —, contas vinculadas, publicar/despublicar) · 404. Ícones são SVG (componente `Icon`) — não usar emoji como ícone. Modais usam `useModalA11y` (foco preso, Esc, aria).

Design system: dark navy `#0A1420` + dourado `#C8963A`; Playfair Display (títulos), IBM Plex Sans (texto), IBM Plex Mono (rótulos `.mono-label`); `.gold-panel` (degradê), `.card-lift` (linha dourada no hover), barras de score em degradê, animações Reveal/CountUp/skeletons, `prefers-reduced-motion` respeitado.

## Regras inegociáveis

1. **Linguagem jurídica (PRD §7.3)**: o Score é "indicador estatístico de aderência tributária". NUNCA usar "certificação", "crédito garantido", "recomendação tributária". O componente `ScoreDisclaimer` é obrigatório em toda tela com score.
2. **Segurança**: nunca expor service role key, secrets ou chaves em código/chat/commits. Chave colada em chat = rotacionar.
3. **Antes de push**: validar sintaxe (`node --check` no módulo extraído; `node --experimental-strip-types --check` nas functions). Push publica em produção.
4. **LGPD**: dados de sócios PF tratados com minimização; páginas /privacidade e /termos refletem o posicionamento.
5. Mudança de banco = migration nova no repo + aplicar no remoto (via MCP do Supabase) registrando a versão no histórico.

## Pendências conhecidas (negócio)

- Domínio próprio (ex.: crivo.com.br) → apontar no Cloudflare + verificar no Resend (`RESEND_FROM`).
- Stripe quando for cobrar (criar conta, setar `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_ID`, `STRIPE_PRICE_PREMIUM_ID`, `STRIPE_WEBHOOK_SECRET`).
- Dimensões "contencioso" e "retenções" do score são placeholders (integrações futuras: tribunais, e-CAC, Painel Receita/Portaria RFB 678, Swagger do Split Payment em consumo.tributos.gov.br).
- Dashboard multiempresa para escritórios (Fase 2 do PRD). O fluxo "Sou Fornecedor" já existe no cadastro (`?perfil=fornecedor`).
- Apagar a function temporária `setup-vault-key` no dashboard (stub inofensivo).
- Ativar "Leaked password protection" no dashboard do Supabase (Authentication → Policies) — não dá para fazer via API.


## King Context

Documentation search and scraping tools are available in this project.

### Commands

~~~bash
# Search indexed documentation
.king-context/bin/kctx list                              # list all indexed docs
.king-context/bin/kctx search "query"                    # search by keywords/use_cases
.king-context/bin/kctx search "query" --doc <name>       # search within one doc
.king-context/bin/kctx read <doc> <section> --preview    # preview a section
.king-context/bin/kctx read <doc> <section>              # read full section
.king-context/bin/kctx topics <doc>                      # browse by tags
.king-context/bin/kctx grep "pattern"                    # regex search across docs
.king-context/bin/kctx ui                                # launch the local read-only UI

# Index documentation
.king-context/bin/kctx index .king-context/data/<file>.json   # index one doc
.king-context/bin/kctx index --all                            # index all docs

# Scrape new documentation
.king-context/bin/king-scrape <url>                      # full pipeline
.king-context/bin/king-scrape <url> --name <name>        # with custom name
.king-context/bin/king-scrape <url> --yes                # skip confirmation
~~~

### Configuration

- API keys: copy `.king-context/.env.example` to `.env` and fill in your keys
- `FIRECRAWL_API_KEY` (required for scraping)
- `OPENROUTER_API_KEY` (optional, for OpenRouter LLM stages or fallback)
- LLM stages can use OpenRouter or Ollama via provider env vars in `.king-context/.env.example`
- Ambiente novo/clone fresco (ex.: sessão na nuvem): o venv (`.king-context/core/`) não vai para o git — rode `npx @king-context/cli init` para reinstalar; sem chave Firecrawl, rode `.king-context/core/venv/bin/crawl4ai-setup` e use `--provider=crawl4ai` nos comandos de scrape

### Directory Structure

- `.king-context/docs/` — indexed documentation (searched by kctx)
- `.king-context/data/` — raw JSON files
- `.king-context/_temp/` — scraper work directories
- `.king-context/_learned/` — agent self-learning shortcuts
