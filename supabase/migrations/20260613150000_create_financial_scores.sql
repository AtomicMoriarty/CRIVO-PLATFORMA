-- Score de Saúde Financeira (a partir do Painel Receita, Portaria RFB 678/2026).
-- Consent-based: o fornecedor compartilha o relatório; a equipe (admin) lança os
-- percentis vs. setor. Guardamos só o derivado (score + faixas), nunca os R$.
create table if not exists public.financial_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  total integer not null check (total between 0 and 1000),
  dim_rentabilidade integer check (dim_rentabilidade between 0 and 1000),
  dim_liquidez integer check (dim_liquidez between 0 and 1000),
  dim_endividamento integer check (dim_endividamento between 0 and 1000),
  percentis jsonb not null default '{}'::jsonb,
  nota text,
  fonte text not null default 'Painel Receita (informado pelo fornecedor)',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists financial_scores_company_idx on public.financial_scores(company_id, created_at desc);

alter table public.financial_scores enable row level security;

-- Leitura: membros da empresa, planos pagos (pro/premium) e admin. Anon NÃO lê
-- (recurso pago — travado no servidor, não só na tela).
create policy "financial_scores_select" on public.financial_scores
  for select to authenticated
  using (
    exists (select 1 from public.company_users cu
            where cu.company_id = financial_scores.company_id and cu.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles p
               where p.id = (select auth.uid()) and p.plan in ('pro','premium'))
    or (select public.is_crivo_admin())
  );

-- Escrita: somente admin (a equipe lança após revisar o Painel enviado).
create policy "financial_scores_admin_write" on public.financial_scores
  for all to authenticated
  using ((select public.is_crivo_admin()))
  with check ((select public.is_crivo_admin()));
