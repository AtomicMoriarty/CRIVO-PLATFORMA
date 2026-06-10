-- Crivo PRD schema, compatible with an existing Supabase project.

create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists full_name text,
  add column if not exists role text not null default 'buyer',
  add column if not exists plan text default 'free',
  add column if not exists partner_code text,
  add column if not exists onboarding_complete boolean default false,
  add column if not exists lgpd_consent_version text,
  add column if not exists lgpd_consent_at timestamptz,
  add column if not exists monitoring_consent boolean default false,
  add column if not exists metadata jsonb default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_crivo_check') then
    alter table public.profiles add constraint profiles_role_crivo_check
      check (role in ('buyer','supplier','accountant','admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_crivo_check') then
    alter table public.profiles add constraint profiles_plan_crivo_check
      check (plan in ('free','pro','premium'));
  end if;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  cnpj text unique not null,
  razao_social text not null,
  nome_fantasia text,
  tipo text check (tipo in ('fornecedor','contratante','ambos')),
  regime text check (regime in ('lucro_real','lucro_presumido','simples','mei')),
  cnae_principal text,
  cnae_descricao text,
  estado char(2),
  municipio text,
  segmento text,
  situacao_rfb text check (situacao_rfb in ('ativa','suspensa','inapta','baixada')) default 'ativa',
  data_abertura date,
  capital_social numeric,
  socios jsonb default '[]',
  raw_rfb jsonb,
  selo_active boolean default false,
  white_label_config jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('owner','admin','viewer')) default 'viewer',
  status text check (status in ('active','pending')) default 'active',
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  version text not null default 'v1',
  total numeric not null check (total between 0 and 1000),
  dim_regularidade numeric,
  dim_regime_cnae numeric,
  dim_documentacao numeric,
  dim_consistencia numeric,
  dim_contencioso numeric,
  dim_societario numeric,
  dim_retencoes numeric,
  explanation jsonb,
  sources_snapshot jsonb,
  calculated_at timestamptz default now()
);

create index if not exists idx_scores_company_date on public.scores(company_id, calculated_at desc);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  tipo text not null,
  filename text not null,
  storage_path text not null,
  valid_until date,
  status text check (status in ('pending','valid','expired','rejected')) default 'pending',
  lgpd_consent boolean default false,
  lgpd_consent_at timestamptz,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.companies(id) on delete cascade,
  supplier_id uuid references public.companies(id) on delete cascade,
  added_by uuid references public.profiles(id),
  status text check (status in ('active','watchlist')) default 'active',
  created_at timestamptz default now(),
  unique(buyer_id, supplier_id)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  tipo text not null,
  severity text check (severity in ('low','medium','high','critical')),
  title text not null,
  description text,
  read_by uuid[] default '{}',
  resolved boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  empresa text,
  source text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade unique,
  partner_code text unique not null,
  escritorio_name text,
  commission_rate numeric default 0.20,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.scores enable row level security;
alter table public.documents enable row level security;
alter table public.portfolios enable row level security;
alter table public.alerts enable row level security;
alter table public.leads enable row level security;
alter table public.partners enable row level security;

drop policy if exists "profiles_own_crivo" on public.profiles;
create policy "profiles_own_crivo" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "companies_read_all_crivo" on public.companies;
create policy "companies_read_all_crivo" on public.companies
  for select to authenticated using (true);

drop policy if exists "companies_insert_crivo" on public.companies;
create policy "companies_insert_crivo" on public.companies
  for insert to authenticated with check (true);

drop policy if exists "companies_update_members_crivo" on public.companies;
create policy "companies_update_members_crivo" on public.companies
  for update to authenticated using (
    exists (
      select 1 from public.company_users
      where company_id = companies.id and user_id = auth.uid() and role in ('owner','admin')
    )
  );

drop policy if exists "company_users_members_crivo" on public.company_users;
create policy "company_users_members_crivo" on public.company_users
  for all to authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.company_users cu
      where cu.company_id = company_users.company_id and cu.user_id = auth.uid() and cu.role in ('owner','admin')
    )
  ) with check (true);

drop policy if exists "scores_read_crivo" on public.scores;
create policy "scores_read_crivo" on public.scores
  for select to authenticated using (true);

drop policy if exists "documents_members_crivo" on public.documents;
create policy "documents_members_crivo" on public.documents
  for all to authenticated using (
    exists (
      select 1 from public.company_users
      where company_id = documents.company_id and user_id = auth.uid()
    )
  ) with check (true);

drop policy if exists "portfolios_own_crivo" on public.portfolios;
create policy "portfolios_own_crivo" on public.portfolios
  for all to authenticated using (
    exists (
      select 1 from public.company_users
      where company_id = portfolios.buyer_id and user_id = auth.uid()
    )
  ) with check (true);

drop policy if exists "alerts_members_crivo" on public.alerts;
create policy "alerts_members_crivo" on public.alerts
  for select to authenticated using (
    exists (
      select 1
      from public.company_users cu
      left join public.portfolios p on p.buyer_id = cu.company_id
      where cu.user_id = auth.uid()
        and (cu.company_id = alerts.company_id or p.supplier_id = alerts.company_id)
    )
  );

drop policy if exists "leads_insert_crivo" on public.leads;
create policy "leads_insert_crivo" on public.leads
  for insert to anon, authenticated with check (true);

drop policy if exists "partners_own_crivo" on public.partners;
create policy "partners_own_crivo" on public.partners
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.mark_alert_read(p_alert_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.alerts
  set read_by = array_append(read_by, p_user_id)
  where id = p_alert_id and not (p_user_id = any(read_by));
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf','text/xml','image/jpeg','image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 2097152)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
