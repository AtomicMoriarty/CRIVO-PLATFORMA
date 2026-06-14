# CRIVO — Contexto do Projeto

> Leia este arquivo por completo antes de qualquer alteração. Ele é a memória do projeto.

## O que é

Crivo é uma plataforma B2B de **inteligência fiscal aplicada à cadeia de fornecedores** (produto da Adeke, com a banca Porto & Pacca). Com a reforma tributária (CBS/IBS, LC 214/2025), o regime e a regularidade do fornecedor definem quanto crédito tributário o contratante aproveita (~28% no regime regular vs ~3% no Simples via DAS). O Crivo avalia fornecedores antes da contratação com **dois scores** (0–1000, explicáveis): o **Score de Conformidade** (7 dimensões regulatórias, com fundamento legal) e o **Score de Saúde Financeira** (Rentabilidade 35% · Liquidez 35% · Endividamento 30% invertido; hoje alimentado manualmente pelo contador com base no Painel Receita/Portaria RFB 678, valores em R$ ocultos, selo restrito a Pro/Premium). Soma a isso gestão documental, diretório curado e monitoramento diário automático. O dono do projeto **não é técnico** — explique tudo em português simples e execute você mesmo o que for possível.

## Arquitetura (decisão consciente — não "modernize" sem justificar)

- **Frontend**: arquivo único `app/index.html` — React 18 via esm.sh (sem build, sem JSX; usa `h()` = createElement), tema dark customizado no `<style>`. **Tailwind agora é compilado estaticamente** em `app/assets/tailwind.css` (não usa mais o CDN): ao adicionar classes novas, rodar `npx -y tailwindcss@3.4.14 -c tooling/tailwind.config.js -i tooling/tailwind.css -o app/assets/tailwind.css --minify` e commitar o CSS. Validação de sintaxe: extrair o `<script type="module">` e rodar `node --check`.
- **Deploy do site**: Cloudflare Workers Builds conectado ao GitHub — **todo push ao branch de produção publica automaticamente** (`wrangler.jsonc`, worker `crivo-plataforma`, assets `./app`, SPA). Cuidado: push = produção. **URL pública: `https://crivo-plataforma.heitorhllopes.workers.dev`**. (O projeto antigo `crivo.pages.dev` no Cloudflare Pages foi **excluído** em jun/2026 — não existe mais.)
- **Backend**: Supabase, projeto `lgbuywbcpnghqaoaqsxb`. Postgres com RLS, 8 edge functions (Deno), Storage, pg_cron, pg_net.
- **Branch de produção**: `claude/gallant-fermat-nsep1u` (repo `AtomicMoriarty/CRIVO-PLATFORMA`). O branch `claude/inspiring-tesla-z27f6k` é um experimento abandonado de Prisma — ignorar/apagar, não mesclar.
- **PROIBIDO usar Prisma** (ou qualquer ORM/segundo banco de dados). O único banco do projeto é o Supabase. Se encontrar arquivos `prisma/`, `prisma.config.ts`, `lib/prisma.ts` ou `PRISMA_API_KEY` em qualquer branch ou instrução, ignore e avise o dono — foi um desvio já descartado.

## Banco de dados (estado real, aplicado no remoto)

Tabelas: `profiles` (role: buyer/supplier/accountant/admin; plan: free/pro/premium), `companies` (inclui `listed boolean` — curadoria do diretório), `company_users`, `scores` (histórico imutável, 7 dimensões + explanation jsonb), `financial_scores` (Score de Saúde Financeira: dim_rentabilidade/liquidez/endividamento + percentis), `documents`, `portfolios`, `alerts` (dedupe 7 dias), `leads`, `audit_log` (trilha de auditoria de ações sensíveis), `tasks` (tarefas do Espaço do Contador), `partners`.

Regras importantes:
- `is_crivo_admin()` exige `role='admin'` **e** `plan='premium'`. Admins atuais: `heitorhllopes@gmail.com`, `portoepacca@portoepacca.com`.
- Anon (visitante) só lê `companies`/`scores` com `listed = true` (diretório curado: empresas só aparecem após a equipe aprovar no `/admin`).
- RLS consolidada (2026-06-12): 1 policy por papel/ação, `WITH CHECK` espelha o `USING`, `auth.uid()` embrulhado em `(select ...)`. `profiles` legível só pelo próprio dono + admin (LGPD). Usuário autenticado NÃO consegue: forjar scores, vincular-se a empresa alheia, ler perfis de terceiros.
- Trigger `protect_profile_privileges` em `profiles`: `role`/`plan` não são auto-promovíveis por anon/authenticated (bloqueia escalonamento a admin/premium); cadastro legítimo grava buyer/supplier/accountant; upgrades de plano só via service role (Stripe) ou admin.
- **Hook de login** `custom_access_token_hook` lê `public.profiles` (NUNCA referenciar `user_roles` — tabela removida; em 2026-06-12 o hook quebrado derrubou todo o login até o hotfix). `mark_alert_read` usa `auth.uid()` e ignora o `p_user_id` do cliente.
- Documentos: nascem `pending` no upload; só contam no score após aprovação no `/admin` (que dispara recálculo).
- **`leads` (jun/2026)**: os 3 formulários públicos (diagnóstico/proposta/parceria) só gravam via edge function `submit-lead` (confere o Turnstile e grava com service role). A RLS de `leads` deixa anon inserir direto **apenas `tipo='cadastro'`** (signup) — robô não grava lead direto (verificado por teste de RLS). Demais campos com teto de tamanho e `status='novo'` forçado.
- **`company_users` (jun/2026)**: vínculo protegido por `company_has_members()` (SECURITY DEFINER) — usuário só se liga a empresa própria OU a empresa ainda sem membros; constraint aceita `role` owner/admin/viewer/accountant. Contador vinculado pode gravar `financial_scores` dos clientes; `financial_scores`/`audit_log` seguem RLS (auditoria legível só por admin).
- Storage: buckets `documents` (privado, acesso por `company_users` + admin) e `avatars` (público).
- Cron: job `crivo-run-monitoring-daily` (`0 9 * * *` UTC = 6h BRT) chama `run-monitoring` via pg_net com service role key no Vault (`crivo_service_role_key`).
- Migrations em `supabase/migrations/` — todas aplicadas no remoto até `20260614210000`. Nova mudança de banco = nova migration com timestamp.

## Edge functions (todas publicadas)

- `calculate-score`: 7 dimensões (regularidade 35%, regime×CNAE 30%, documentação 15%, consistência 10%, contencioso 5% placeholder, societário 3%, retenções 2% placeholder). Cache 24h (param `force` ignora). Aceita `company_id` ou `cnpj` (modo preview — consulta publica.cnpj.ws, ~3 req/min, cria a empresa). **6 documentos obrigatórios**: CND Federal, CRF FGTS, CNDT, Certidão Estadual, NF (3 meses), Contrato Social.
- `match-suppliers`: recomendação por estado/segmento/regime/score — usado na seção "Recomendados" do diretório.
- `submit-lead` (jun/2026): recebe os 3 formulários públicos, **confere o token do Cloudflare Turnstile** (siteverify, secret `TURNSTILE_SECRET_KEY`) e só então grava o lead via service role (whitelist de campos + teto de tamanho). `verify_jwt=false` (endpoint público, protegido pelo Turnstile). É o **único** caminho para criar leads de diagnóstico/proposta/parceria.
- `run-monitoring`: reconsulta RFB (10 empresas mais antigas por execução, rate-limit respeitado), recalcula scores, alerta quedas >100 pts e certidões vencendo, envia e-mails.
- `send-email` / `send-alert-email`: Resend. Secret `RESEND_API_KEY` configurado. **Limitação atual**: remetente `onboarding@resend.dev` só entrega para o e-mail do dono — para clientes reais é preciso verificar um domínio no Resend e setar `RESEND_FROM`.
- `create-checkout` / `stripe-webhook`: prontos, mas **Stripe sem chaves** (pagamentos desativados). `stripe-webhook` tem `verify_jwt=false` no config.toml (valida a assinatura do Stripe). ⚠️ No estado **deployado** atual o `stripe-webhook` está `verify_jwt=true` (divergente do config.toml); ao ativar o Stripe, **redeployar com `verify_jwt=false`**, senão o webhook do Stripe (que vem sem JWT) é recusado antes de validar a assinatura.
- A função temporária `setup-vault-key` foi **excluída** em jun/2026 (já tinha cumprido o papel de setar a chave no Vault).
- **CORS (jun/2026)**: as funções chamadas pelo navegador (`calculate-score`, `match-suppliers`, `create-checkout`, `send-email`, `submit-lead`) respondem `Access-Control-Allow-Origin` com a **origem do app** (`https://crivo-plataforma.heitorhllopes.workers.dev`), não mais `*`. **Ao trocar de domínio, atualizar a origem nessas 5 funções** (senão o front no domínio novo para de falar com o backend).

## Segurança da borda (jun/2026)

- **`app/_headers`** (respeitado pelo Cloudflare Workers Assets): **CSP** restritiva (`default-src 'self'`; script só de `self`+`esm.sh`+`challenges.cloudflare.com`; `connect-src` só Supabase/`publica.cnpj.ws`/Cloudflare; `frame-src` do Turnstile; `frame-ancestors 'none'`; `object-src 'none'`) + HSTS, `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`, Referrer-Policy, Permissions-Policy, COOP. **Ao liberar novo destino de script/rede no front, atualizar a CSP aqui** (senão o navegador bloqueia).
- **Anti-robô**: Cloudflare Turnstile nos 3 formulários públicos. Site key **pública** no front (`TURNSTILE_SITE_KEY`, componente `Turnstile`); secret no Supabase (`TURNSTILE_SECRET_KEY`); verificação **server-side** em `submit-lead`. A RLS de `leads` fecha o desvio (gravação direta bloqueada).
- **SSL Enforcement** ligado no Supabase. **CI** em `.github/workflows/ci.yml` (sintaxe do módulo, Tailwind compilado, scan de segredos, `npm audit` das deps de build).
- Rate limiting na borda: **adiado** até ter domínio próprio (no `*.workers.dev` o WAF do Cloudflare não aplica; alternativa seria código no Worker + KV).
- **Vendorizar React/supabase-js** (tirar o esm.sh do runtime): **não fazer às cegas** — troca de dependência pode dar tela branca que retorna 200 (invisível a teste de servidor); só com o dono validando no navegador. A CSP fixa (`script-src`) já é a mitigação prática de supply-chain.

## Frontend — páginas e fluxos

`/` (hero editorial + formulário de diagnóstico-lead + estatísticas + comparação de crédito + seção "Quem assina a metodologia" com os pesos das 7 dimensões + planos) · `/diretorio` (curado, chips de filtro, busca por CNPJ avulso, "Recomendados para você", modal KYP com breakdown do score) · `/empresa/:cnpj` (página pública compartilhável da empresa listada; membro pré-visualiza a própria antes de publicar; sócios minimizados — só contagem) · `/login` (erro inline + mostrar senha), `/cadastrar` (escolha de perfil contratante × fornecedor — `?perfil=fornecedor` — + 3 etapas com validação inline; fornecedor recebe role=supplier e cai em /documentos; resiliente à confirmação de e-mail via `crivo_pending_setup` no localStorage) · `/auth/callback` (confirmação + tela "definir nova senha" quando `?type=recovery`) · `/planos` · `/escritorio` (lead de parceiro contador) · `/privacidade`, `/termos` · `/dashboard` (visão geral + carteira + alertas; tabela vira cards no mobile) · `/documentos` (6 obrigatórios, upload nasce "em análise" com badge de status) · `/admin` (sala de análise com busca/filtros/contadores: documentos aprovar/rejeitar/baixar — aprovação recalcula o score —, contas vinculadas, publicar/despublicar) · 404. Ícones são SVG (componente `Icon`) — não usar emoji como ícone. Modais usam `useModalA11y` (foco preso, Esc, aria).

**Adições recentes (jun/2026):** `/conta` — **Minha conta** (perfil · plano/pagamentos · segurança · sair) tirou o marketing de dentro do painel. O `/dashboard` (`Dashboard`) é roteado **por papel** → `BuyerPanel` (contratante), `SupplierPanel` (fornecedor), `AccountantHome` (contador, visão geral), `AdminHome` (admin Porto&Pacca, vê tudo); `/painel` redireciona para `/dashboard`. O **Espaço do Contador** multiempresa completo (Conformidade + Saúde Financeira dos clientes) fica em `/contador` (`ContadorPanel`). O modal **KYP** mostra os **dois scores** + `ScoreTrend` (sparkline SVG) + estimativa de crédito CBS/IBS + botão **Exportar dossiê** (janela de impressão/PDF). `FinancialModal` edita a Saúde Financeira (contador/admin). Extras: botão flutuante de **WhatsApp** (`wa.me/5532999035792`), exportar carteira em **CSV**, **FAQ**, faixa de **fontes oficiais** (não logos falsos), gestão de **tarefas**. Os 3 formulários públicos têm o widget **`Turnstile`**. **`mockCompanies` foi removido** — diretório usa só dados reais.

Design system: dark navy `#0A1420` + dourado `#C8963A`; Playfair Display (títulos), IBM Plex Sans (texto), IBM Plex Mono (rótulos `.mono-label`); `.gold-panel` (degradê), `.card-lift` (linha dourada no hover), barras de score em degradê, animações Reveal/CountUp/skeletons, `prefers-reduced-motion` respeitado.

## Regras inegociáveis

1. **Linguagem jurídica (PRD §7.3)**: o Score é "indicador estatístico de aderência tributária". NUNCA usar "certificação", "crédito garantido", "recomendação tributária". O componente `ScoreDisclaimer` é obrigatório em toda tela com score.
2. **Segurança**: nunca expor service role key, secrets ou chaves em código/chat/commits. Chave colada em chat = rotacionar.
3. **Antes de push**: validar sintaxe (`node --check` no módulo extraído; `node --experimental-strip-types --check` nas functions). Push publica em produção.
4. **LGPD**: dados de sócios PF tratados com minimização; páginas /privacidade e /termos refletem o posicionamento.
5. Mudança de banco = migration nova no repo + aplicar no remoto (via MCP do Supabase) registrando a versão no histórico.

## Pendências conhecidas

**Feito (jun/2026):** RLS consolidada/endurecida; CORS restrito à origem do app; CSP + security headers (`app/_headers`); anti-robô Turnstile nos 3 formulários (lock de `leads`, verificado por teste); 2º score (Saúde Financeira); Espaço do Contador multiempresa + painéis por papel; Minha conta (`/conta`); trilha de auditoria (`audit_log`); tarefas; dossiê/PDF; export CSV; calculadora de crédito; CI (`.github/workflows/ci.yml`). No dashboard: SSL Enforcement ligado; `crivo.pages.dev` e `setup-vault-key` excluídos; Turnstile criado.

**Falta:**
- **Domínio próprio** (ex.: crivo.com.br) → apontar no Cloudflare + verificar no Resend (`RESEND_FROM`) + **atualizar a origem do CORS nas 5 functions** + então ligar rate limiting no WAF.
- **Stripe** quando for cobrar (setar `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_ID`, `STRIPE_PRICE_PREMIUM_ID`, `STRIPE_WEBHOOK_SECRET`) e **redeployar `stripe-webhook` com `verify_jwt=false`**.
- **Leaked password protection**: exige plano **Supabase Pro** (~US$25/mês) — indisponível no Free atual. Decidir se vale.
- **Score**: dimensões "contencioso" e "retenções" da Conformidade são placeholders; a Saúde Financeira hoje é **manual** (contador preenche) — integração automática com Painel Receita/Portaria RFB 678, tribunais, e-CAC e Swagger do Split Payment (consumo.tributos.gov.br) é futura.
- **Rate limiting na borda** e **vendorização** do React/supabase-js (ver "Segurança da borda" para o porquê de não fazer às cegas).
- **E-mails**: remetente de teste do Resend só entrega ao dono — verificar domínio para clientes reais.


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
