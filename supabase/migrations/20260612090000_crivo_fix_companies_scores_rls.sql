-- Corrige vazamento de dados: qualquer usuário autenticado conseguia ler
-- TODAS as empresas (incluindo não publicadas, com sócios/PII) e TODOS os
-- scores via as políticas "companies_read_all_crivo" e "scores_read_crivo"
-- (USING true). Agora só veem: empresas publicadas (listed=true), empresas
-- próprias/das quais são membros, ou se forem admin Crivo.

drop policy if exists companies_read_all_crivo on public.companies;

create policy companies_read_member_or_listed_crivo on public.companies
  for select to authenticated
  using (
    listed = true
    or user_id = auth.uid()
    or public.is_company_member(id, null)
    or public.is_crivo_admin()
  );

drop policy if exists scores_read_crivo on public.scores;

create policy scores_read_member_or_listed_crivo on public.scores
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = scores.company_id
        and (c.listed = true or c.user_id = auth.uid() or public.is_company_member(c.id, null))
    )
    or public.is_crivo_admin()
  );
