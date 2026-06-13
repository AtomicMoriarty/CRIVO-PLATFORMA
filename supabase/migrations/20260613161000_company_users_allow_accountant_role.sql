-- A coluna role não permitia 'accountant' → todo vínculo de contador quebrava
-- (erro company_users_role_check ao adicionar cliente / convidar contador).
alter table public.company_users drop constraint company_users_role_check;
alter table public.company_users add constraint company_users_role_check
  check (role = any (array['owner','admin','viewer','accountant']));
