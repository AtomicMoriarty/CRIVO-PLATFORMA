-- Compatibility columns used by the Crivo frontend modules.

alter table public.leads
  alter column nome drop not null,
  alter column email drop not null,
  add column if not exists tipo text,
  add column if not exists cnpj text,
  add column if not exists telefone text,
  add column if not exists origem text,
  add column if not exists status text default 'novo',
  add column if not exists plano_interesse text,
  add column if not exists mensagem text,
  add column if not exists crc text,
  add column if not exists escritorio text,
  add column if not exists qtd_clientes_pj integer,
  add column if not exists canal_aquisicao text;

alter table public.companies
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists telefone text,
  add column if not exists cargo_responsavel text,
  add column if not exists endereco jsonb default '{}';

alter table public.documents
  add column if not exists url text,
  add column if not exists tamanho bigint,
  add column if not exists validade date;

drop policy if exists "scores_insert_service_crivo" on public.scores;
create policy "scores_insert_service_crivo" on public.scores
  for insert to authenticated with check (true);

drop policy if exists "alerts_update_members_crivo" on public.alerts;
create policy "alerts_update_members_crivo" on public.alerts
  for update to authenticated using (
    exists (
      select 1
      from public.company_users cu
      left join public.portfolios p on p.buyer_id = cu.company_id
      where cu.user_id = auth.uid()
        and (cu.company_id = alerts.company_id or p.supplier_id = alerts.company_id)
    )
  ) with check (true);

drop policy if exists "documents_insert_members_crivo" on public.documents;
create policy "documents_insert_members_crivo" on public.documents
  for insert to authenticated with check (
    exists (
      select 1 from public.company_users
      where company_id = documents.company_id and user_id = auth.uid()
    )
  );
