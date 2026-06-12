-- ============================================================================
-- Consolidação e blindagem de RLS (responde aos advisors de segurança e
-- performance do Supabase). Princípios:
--   1) Uma única policy por (papel, ação) -> elimina "multiple permissive".
--   2) auth.uid()/helpers embrulhados em (select ...) -> elimina "initplan".
--   3) WITH CHECK passa a espelhar o USING -> elimina "policy always true" e
--      fecha vetores de escalonamento (scores forjados, vínculo indevido).
--   4) profiles deixa de ser legível por qualquer autenticado (minimização LGPD).
-- Funções SECURITY DEFINER (is_crivo_admin/is_company_member) ignoram RLS por
-- design, então não há recursão ao referenciá-las aqui.
-- ============================================================================

-- ---------- profiles ----------
drop policy if exists "Admin email can manage profiles" on public.profiles;
drop policy if exists "Authenticated can read all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists admins_read_profiles_crivo on public.profiles;
drop policy if exists profiles_own_crivo on public.profiles;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_crivo_admin()));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_crivo_admin()))
  with check (id = (select auth.uid()) or (select public.is_crivo_admin()));
create policy profiles_delete on public.profiles for delete to authenticated
  using ((select public.is_crivo_admin()));

-- ---------- companies ----------
drop policy if exists admins_manage_companies_crivo on public.companies;
drop policy if exists companies_insert_crivo on public.companies;
drop policy if exists companies_read_member_or_listed_crivo on public.companies;
drop policy if exists companies_read_public_crivo on public.companies;
drop policy if exists companies_update_members_crivo on public.companies;

create policy companies_select_anon on public.companies for select to anon
  using (listed = true);
create policy companies_select_auth on public.companies for select to authenticated
  using (
    listed = true
    or user_id = (select auth.uid())
    or (select public.is_company_member(id, null))
    or (select public.is_crivo_admin())
  );
create policy companies_insert_auth on public.companies for insert to authenticated
  with check (user_id = (select auth.uid()) or user_id is null or (select public.is_crivo_admin()));
create policy companies_update_auth on public.companies for update to authenticated
  using ((select public.is_company_member(id, array['owner','admin'])) or (select public.is_crivo_admin()))
  with check ((select public.is_company_member(id, array['owner','admin'])) or (select public.is_crivo_admin()));
create policy companies_delete_admin on public.companies for delete to authenticated
  using ((select public.is_crivo_admin()));

-- ---------- scores (histórico imutável; gravação via service role/admin) ----------
drop policy if exists admins_manage_scores_crivo on public.scores;
drop policy if exists scores_insert_service_crivo on public.scores;
drop policy if exists scores_read_member_or_listed_crivo on public.scores;
drop policy if exists scores_read_public_crivo on public.scores;

create policy scores_select_anon on public.scores for select to anon
  using (exists (select 1 from public.companies c where c.id = scores.company_id and c.listed = true));
create policy scores_select_auth on public.scores for select to authenticated
  using (
    (select public.is_crivo_admin())
    or exists (
      select 1 from public.companies c
      where c.id = scores.company_id
        and (c.listed = true or c.user_id = (select auth.uid()) or (select public.is_company_member(c.id, null)))
    )
  );
-- Apenas admin pode inserir/alterar via API; o edge function usa service role (ignora RLS).
create policy scores_insert_admin on public.scores for insert to authenticated
  with check ((select public.is_crivo_admin()));
create policy scores_update_admin on public.scores for update to authenticated
  using ((select public.is_crivo_admin())) with check ((select public.is_crivo_admin()));
create policy scores_delete_admin on public.scores for delete to authenticated
  using ((select public.is_crivo_admin()));

-- ---------- documents ----------
drop policy if exists admins_manage_documents_crivo on public.documents;
drop policy if exists documents_insert_members_crivo on public.documents;
drop policy if exists documents_members_crivo on public.documents;

create policy documents_select on public.documents for select to authenticated
  using ((select public.is_company_member(company_id, null)) or (select public.is_crivo_admin()));
create policy documents_insert on public.documents for insert to authenticated
  with check ((select public.is_company_member(company_id, null)) or (select public.is_crivo_admin()));
create policy documents_update on public.documents for update to authenticated
  using ((select public.is_company_member(company_id, null)) or (select public.is_crivo_admin()))
  with check ((select public.is_company_member(company_id, null)) or (select public.is_crivo_admin()));
create policy documents_delete on public.documents for delete to authenticated
  using ((select public.is_company_member(company_id, null)) or (select public.is_crivo_admin()));

-- ---------- company_users ----------
drop policy if exists admins_manage_company_users_crivo on public.company_users;
drop policy if exists company_users_members_crivo on public.company_users;

create policy company_users_select on public.company_users for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_company_member(company_id, array['owner','admin']))
    or (select public.is_crivo_admin())
  );
create policy company_users_insert on public.company_users for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (select public.is_company_member(company_id, array['owner','admin']))
    or (select public.is_crivo_admin())
  );
create policy company_users_update on public.company_users for update to authenticated
  using ((select public.is_company_member(company_id, array['owner','admin'])) or (select public.is_crivo_admin()))
  with check ((select public.is_company_member(company_id, array['owner','admin'])) or (select public.is_crivo_admin()));
create policy company_users_delete on public.company_users for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_company_member(company_id, array['owner','admin']))
    or (select public.is_crivo_admin())
  );

-- ---------- portfolios ----------
drop policy if exists admins_manage_portfolios_crivo on public.portfolios;
drop policy if exists portfolios_own_crivo on public.portfolios;

create policy portfolios_select on public.portfolios for select to authenticated
  using ((select public.is_company_member(buyer_id, null)) or (select public.is_crivo_admin()));
create policy portfolios_insert on public.portfolios for insert to authenticated
  with check ((select public.is_company_member(buyer_id, null)) or (select public.is_crivo_admin()));
create policy portfolios_update on public.portfolios for update to authenticated
  using ((select public.is_company_member(buyer_id, null)) or (select public.is_crivo_admin()))
  with check ((select public.is_company_member(buyer_id, null)) or (select public.is_crivo_admin()));
create policy portfolios_delete on public.portfolios for delete to authenticated
  using ((select public.is_company_member(buyer_id, null)) or (select public.is_crivo_admin()));

-- ---------- alerts (criados pelo monitoramento via service role) ----------
drop policy if exists admins_manage_alerts_crivo on public.alerts;
drop policy if exists alerts_members_crivo on public.alerts;
drop policy if exists alerts_update_members_crivo on public.alerts;

create policy alerts_select on public.alerts for select to authenticated
  using (
    (select public.is_crivo_admin())
    or exists (
      select 1 from public.company_users cu
      left join public.portfolios p on p.buyer_id = cu.company_id
      where cu.user_id = (select auth.uid())
        and (cu.company_id = alerts.company_id or p.supplier_id = alerts.company_id)
    )
  );
create policy alerts_update on public.alerts for update to authenticated
  using (
    (select public.is_crivo_admin())
    or exists (
      select 1 from public.company_users cu
      left join public.portfolios p on p.buyer_id = cu.company_id
      where cu.user_id = (select auth.uid())
        and (cu.company_id = alerts.company_id or p.supplier_id = alerts.company_id)
    )
  )
  with check (
    (select public.is_crivo_admin())
    or exists (
      select 1 from public.company_users cu
      left join public.portfolios p on p.buyer_id = cu.company_id
      where cu.user_id = (select auth.uid())
        and (cu.company_id = alerts.company_id or p.supplier_id = alerts.company_id)
    )
  );
create policy alerts_insert_admin on public.alerts for insert to authenticated
  with check ((select public.is_crivo_admin()));
create policy alerts_delete_admin on public.alerts for delete to authenticated
  using ((select public.is_crivo_admin()));

-- ---------- partners ----------
drop policy if exists admins_manage_partners_crivo on public.partners;
drop policy if exists partners_own_crivo on public.partners;

create policy partners_select on public.partners for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_crivo_admin()));
create policy partners_insert on public.partners for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_crivo_admin()));
create policy partners_update on public.partners for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_crivo_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_crivo_admin()));
create policy partners_delete on public.partners for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_crivo_admin()));

-- ---------- leads (formulários públicos entram; só admin lê/gere) ----------
drop policy if exists admins_read_leads_crivo on public.leads;
drop policy if exists leads_insert_crivo on public.leads;

create policy leads_insert on public.leads for insert to anon, authenticated
  with check (true);
create policy leads_select_admin on public.leads for select to authenticated
  using ((select public.is_crivo_admin()));
create policy leads_update_admin on public.leads for update to authenticated
  using ((select public.is_crivo_admin())) with check ((select public.is_crivo_admin()));
create policy leads_delete_admin on public.leads for delete to authenticated
  using ((select public.is_crivo_admin()));
