-- Diretório curado: empresas só aparecem publicamente após aprovação da equipe Crivo.

alter table public.companies add column if not exists listed boolean default false;

-- Visitantes (anon) só veem empresas aprovadas.
drop policy if exists "companies_read_public_crivo" on public.companies;
create policy "companies_read_public_crivo" on public.companies
  for select to anon using (listed = true);

drop policy if exists "scores_read_public_crivo" on public.scores;
create policy "scores_read_public_crivo" on public.scores
  for select to anon using (
    exists (select 1 from public.companies c where c.id = scores.company_id and c.listed)
  );
