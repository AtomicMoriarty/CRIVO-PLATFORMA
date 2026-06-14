-- 1) Completa o hardening: o anon recebe grant DIRETO por padrão no Supabase, então
--    o "revoke from public" anterior não bastou. crivo_audit é trigger → tira de todos.
revoke all on function public.company_has_members(uuid) from anon;
revoke all on function public.crivo_audit() from anon, authenticated;

-- 2) Índices nas FKs created_by (advisor performance)
create index if not exists financial_scores_created_by_idx on public.financial_scores(created_by);
create index if not exists tasks_created_by_idx on public.tasks(created_by);

-- 3) Consolida as políticas de financial_scores (remove as permissivas duplicadas:
--    a admin_write era "for all" e sobrepunha o SELECT/INSERT).
drop policy if exists "financial_scores_admin_write" on public.financial_scores;
drop policy if exists "financial_scores_accountant_write" on public.financial_scores;
create policy "financial_scores_insert" on public.financial_scores for insert to authenticated
  with check (
    (select public.is_crivo_admin())
    or exists (select 1 from public.company_users cu
               where cu.company_id = financial_scores.company_id
                 and cu.user_id = (select auth.uid()) and cu.role = 'accountant')
  );
create policy "financial_scores_update" on public.financial_scores for update to authenticated
  using ((select public.is_crivo_admin())) with check ((select public.is_crivo_admin()));
create policy "financial_scores_delete" on public.financial_scores for delete to authenticated
  using ((select public.is_crivo_admin()));
