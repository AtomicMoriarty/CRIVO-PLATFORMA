-- Remove sistema de admin duplicado herdado do template inicial (tabela
-- user_roles + enum app_role + função is_admin() + políticas "admin_*_all_*").
-- O Crivo usa exclusivamente is_crivo_admin() (profiles.role='admin' e
-- plan='premium'), que já tem políticas próprias ("admins_manage_*_crivo")
-- cobrindo companies, scores, documents, alerts, portfolios, company_users,
-- partners e leitura de profiles/leads. O único registro em user_roles
-- (portoepacca@portoepacca.com) já é admin Crivo pelos dois sistemas.

drop policy if exists admin_select_all_companies on public.companies;
drop policy if exists admin_insert_all_companies on public.companies;
drop policy if exists admin_update_all_companies on public.companies;
drop policy if exists admin_delete_all_companies on public.companies;

drop policy if exists admin_select_all_documents on public.documents;
drop policy if exists admin_insert_all_documents on public.documents;
drop policy if exists admin_update_all_documents on public.documents;
drop policy if exists admin_delete_all_documents on public.documents;

drop policy if exists admin_select_all_scores on public.scores;
drop policy if exists admin_insert_all_scores on public.scores;
drop policy if exists admin_update_all_scores on public.scores;
drop policy if exists admin_delete_all_scores on public.scores;

drop policy if exists admin_select_all_portfolios on public.portfolios;
drop policy if exists admin_insert_all_portfolios on public.portfolios;
drop policy if exists admin_update_all_portfolios on public.portfolios;
drop policy if exists admin_delete_all_portfolios on public.portfolios;

drop policy if exists admin_select_all_alerts on public.alerts;
drop policy if exists admin_insert_all_alerts on public.alerts;
drop policy if exists admin_update_all_alerts on public.alerts;
drop policy if exists admin_delete_all_alerts on public.alerts;

drop policy if exists admin_select_all_leads on public.leads;
drop policy if exists admin_insert_all_leads on public.leads;
drop policy if exists admin_update_all_leads on public.leads;
drop policy if exists admin_delete_all_leads on public.leads;

drop policy if exists admin_select_all_company_users on public.company_users;
drop policy if exists admin_insert_all_company_users on public.company_users;
drop policy if exists admin_update_all_company_users on public.company_users;
drop policy if exists admin_delete_all_company_users on public.company_users;

drop policy if exists admin_select_all_profiles on public.profiles;
drop policy if exists admin_insert_all_profiles on public.profiles;
drop policy if exists admin_update_all_profiles on public.profiles;
drop policy if exists admin_delete_all_profiles on public.profiles;

drop policy if exists admin_select_all_partners on public.partners;
drop policy if exists admin_insert_all_partners on public.partners;
drop policy if exists admin_update_all_partners on public.partners;
drop policy if exists admin_delete_all_partners on public.partners;

-- Tabelas que não fazem parte do produto Crivo (resíduo do template de origem,
-- sem uso no frontend). Removidas junto com o sistema de admin duplicado.
drop policy if exists admin_select_all_notifications on public.notifications;
drop policy if exists admin_insert_all_notifications on public.notifications;
drop policy if exists admin_update_all_notifications on public.notifications;
drop policy if exists admin_delete_all_notifications on public.notifications;
drop table if exists public.notifications;

drop policy if exists admin_select_all_personal_notes on public.personal_notes;
drop policy if exists admin_insert_all_personal_notes on public.personal_notes;
drop policy if exists admin_update_all_personal_notes on public.personal_notes;
drop policy if exists admin_delete_all_personal_notes on public.personal_notes;
drop table if exists public.personal_notes;

drop policy if exists admin_select_all_dashboard_state on public.dashboard_state;
drop policy if exists admin_insert_all_dashboard_state on public.dashboard_state;
drop policy if exists admin_update_all_dashboard_state on public.dashboard_state;
drop policy if exists admin_delete_all_dashboard_state on public.dashboard_state;
drop policy if exists "Authenticated can insert dashboard" on public.dashboard_state;
drop policy if exists "Authenticated can update dashboard" on public.dashboard_state;
drop table if exists public.dashboard_state;

-- Sistema de admin duplicado propriamente
drop table if exists public.user_roles;
drop function if exists public.is_admin();
drop type if exists public.app_role;
