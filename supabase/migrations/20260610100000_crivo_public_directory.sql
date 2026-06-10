-- Diretório público: visitantes (anon) podem ler empresas e scores.
-- São dados públicos da Receita Federal; documentos e carteiras continuam restritos.

drop policy if exists "companies_read_public_crivo" on public.companies;
create policy "companies_read_public_crivo" on public.companies
  for select to anon using (true);

drop policy if exists "scores_read_public_crivo" on public.scores;
create policy "scores_read_public_crivo" on public.scores
  for select to anon using (true);
