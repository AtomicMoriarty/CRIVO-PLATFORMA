-- Tarefas por empresa (PRD 5.7): solicitar documento, acionar fornecedor, etc.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references auth.users(id),
  title text not null,
  status text not null default 'open' check (status in ('open','done')),
  due_date date,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists tasks_company_idx on public.tasks(company_id, status, created_at desc);
alter table public.tasks enable row level security;

-- Membros da empresa (dono/contador) e admin gerenciam as tarefas dela.
create policy "tasks_all" on public.tasks for all to authenticated
  using ((select public.is_company_member(company_id, null)) or (select public.is_crivo_admin()))
  with check ((select public.is_company_member(company_id, null)) or (select public.is_crivo_admin()));
