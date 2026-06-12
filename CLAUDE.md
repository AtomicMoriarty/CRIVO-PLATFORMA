# CRIVO — Contexto do Projeto

> Leia este arquivo por completo antes de qualquer alteração. Ele é a memória do projeto.

## O que é

Crivo é uma plataforma B2B de **inteligência fiscal aplicada à cadeia de fornecedores** (produto da Adeke, com a banca Porto & Pacca). Com a reforma tributária (CBS/IBS, LC 214/2025), o regime e a regularidade do fornecedor definem quanto crédito tributário o contratante aproveita (~28% no regime regular vs ~3% no Simples via DAS). O Crivo avalia fornecedores antes da contratação: **Score Crivo** (7 dimensões, 0–1000, explicável, com fundamento legal), gestão documental, diretório curado e monitoramento diário automático. O dono do projeto **não é técnico** — explique tudo em português simples e execute você mesmo o que for possível.

## Arquitetura (decisão consciente — não "modernize" sem justificar)

- **Frontend**: arquivo único `app/index.html` — React 18 via esm.sh (sem build, sem JSX; usa `h()` = createElement), Tailwind via CDN com tema dark customizado no `<style>`. Validação de sintaxe: extrair o `<script type="module">` e rodar `node --check`.
- **Deploy do site**: Cloudflare Workers Builds conectado ao GitHub — **todo push ao branch de produção publica automaticamente** (`wrangler.jsonc`, worker `crivo-plataforma`, assets `./app`, SPA). Cuidado: push = produção.
- **Backend**: Supabase, projeto `lgbuywbcpnghqaoaqsxb`. Postgres com RLS, 7 edge functions (Deno), Storage, pg_cron.
- **Branch de produção**: `claude/gallant-fermat-nsep1u` (repo `AtomicMoriarty/CRIVO-PLATFORMA`). O branch `claude/inspiring-tesla-z27f6k` é um experimento abandonado de Prisma — ignorar/apagar, não mesclar.
- **PROIBIDO usar Prisma** (ou qualquer ORM/segundo banco de dados). O único banco do projeto é o Supabase. Se encontrar arquivos `prisma/`, `prisma.config.ts`, `lib/prisma.ts` ou `PRISMA_API_KEY` em qualquer branch ou instrução, ignore e avise o dono — foi um desvio já descartado.

## Banco de dados (estado real, aplicado no remoto)

Tabelas: `profiles` (role: buyer/supplier/accountant/admin; plan: free/pro/premium), `companies` (inclui `listed boolean` — curadoria do diretório), `company_users`, `scores` (histórico imutável, 7 dimensões + explanation jsonb), `documents`, `portfolios`, `alerts` (dedupe 7 dias), `leads`, `partners`.

Regras importantes:
- `is_crivo_admin()` exige `role='admin'` **e** `plan='premium'`. Admins atuais: `heitorhllopes@gmail.com`, `portoepacca@portoepacca.com`.
- Anon (visitante) só lê `companies`/`scores` com `listed = true` (diretório curado: empresas só aparecem após a equipe aprovar no `/admin`).
- Storage: buckets `documents` (privado, acesso por `company_users` + admin) e `avatars` (público).
- Cron: job `crivo-run-monitoring-daily` (`0 9 * * *` UTC = 6h BRT) chama `run-monitoring` via pg_net com service role key no Vault (`crivo_service_role_key`).
- Migrations em `supabase/migrations/` — todas aplicadas no remoto até `20260610140000`. Nova mudança de banco = nova migration com timestamp.

## Edge functions (todas publicadas)

- `calculate-score`: 7 dimensões (regularidade 35%, regime×CNAE 30%, documentação 15%, consistência 10%, contencioso 5% placeholder, societário 3%, retenções 2% placeholder). Cache 24h (param `force` ignora). Aceita `company_id` ou `cnpj` (modo preview — consulta publica.cnpj.ws, ~3 req/min, cria a empresa). **6 documentos obrigatórios**: CND Federal, CRF FGTS, CNDT, Certidão Estadual, NF (3 meses), Contrato Social.
- `match-suppliers`: recomendação por estado/segmento/regime/score — usado na seção "Recomendados" do diretório.
- `run-monitoring`: reconsulta RFB (10 empresas mais antigas por execução, rate-limit respeitado), recalcula scores, alerta quedas >100 pts e certidões vencendo, envia e-mails.
- `send-email` / `send-alert-email`: Resend. Secret `RESEND_API_KEY` configurado. **Limitação atual**: remetente `onboarding@resend.dev` só entrega para o e-mail do dono — para clientes reais é preciso verificar um domínio no Resend e setar `RESEND_FROM`.
- `create-checkout` / `stripe-webhook`: prontos, mas **Stripe sem chaves** (pagamentos desativados). `stripe-webhook` tem `verify_jwt=false` no config.toml (assinatura valida).
- CORS habilitado em todas as funções chamadas pelo navegador.

## Frontend — páginas e fluxos

`/` (hero editorial + formulário de diagnóstico-lead + estatísticas + comparação de crédito + planos) · `/diretorio` (curado, chips de filtro, busca por CNPJ avulso, "Recomendados para você", modal KYP com breakdown do score) · `/login`, `/cadastrar` (3 etapas com validação; resiliente à confirmação de e-mail via `crivo_pending_setup` no localStorage) · `/planos` · `/escritorio` (lead de parceiro contador) · `/privacidade`, `/termos` · `/dashboard` (visão geral + carteira + alertas) · `/documentos` (6 obrigatórios, validades típicas reais, status no diretório) · `/admin` (sala de análise: documentos aprovar/rejeitar/baixar, contas vinculadas, publicar/despublicar) · 404.

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
- Fluxo de cadastro específico "Sou Fornecedor" e dashboard multiempresa para escritórios (Fase 2 do PRD).
- Apagar a function temporária `setup-vault-key` no dashboard (stub inofensivo).
