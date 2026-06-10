-- Admin policies for full Crivo review access.

create or replace function public.is_crivo_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and plan = 'premium'
  );
$$;

drop policy if exists "admins_manage_companies_crivo" on public.companies;
create policy "admins_manage_companies_crivo" on public.companies
  for all to authenticated using (public.is_crivo_admin()) with check (public.is_crivo_admin());

drop policy if exists "admins_manage_company_users_crivo" on public.company_users;
create policy "admins_manage_company_users_crivo" on public.company_users
  for all to authenticated using (public.is_crivo_admin()) with check (public.is_crivo_admin());

drop policy if exists "admins_manage_scores_crivo" on public.scores;
create policy "admins_manage_scores_crivo" on public.scores
  for all to authenticated using (public.is_crivo_admin()) with check (public.is_crivo_admin());

drop policy if exists "admins_manage_documents_crivo" on public.documents;
create policy "admins_manage_documents_crivo" on public.documents
  for all to authenticated using (public.is_crivo_admin()) with check (public.is_crivo_admin());

drop policy if exists "admins_manage_portfolios_crivo" on public.portfolios;
create policy "admins_manage_portfolios_crivo" on public.portfolios
  for all to authenticated using (public.is_crivo_admin()) with check (public.is_crivo_admin());

drop policy if exists "admins_manage_alerts_crivo" on public.alerts;
create policy "admins_manage_alerts_crivo" on public.alerts
  for all to authenticated using (public.is_crivo_admin()) with check (public.is_crivo_admin());

drop policy if exists "admins_read_leads_crivo" on public.leads;
create policy "admins_read_leads_crivo" on public.leads
  for select to authenticated using (public.is_crivo_admin());

drop policy if exists "admins_manage_partners_crivo" on public.partners;
create policy "admins_manage_partners_crivo" on public.partners
  for all to authenticated using (public.is_crivo_admin()) with check (public.is_crivo_admin());
