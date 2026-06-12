-- BUG CRÍTICO DE CADASTRO: a tabela profiles tinha DUAS check constraints de role
-- ativas ao mesmo tempo:
--   profiles_role_check       -> role IN ('admin','member')        (resíduo do template)
--   profiles_role_crivo_check -> role IN ('buyer','supplier','accountant','admin','member')
-- Como ambas precisam ser satisfeitas, role só podia ser 'admin' ou 'member'.
-- O fluxo de cadastro (completeSetup) grava role='buyer', que violava a constraint
-- legada e fazia o upsert do profile falhar -> empresa nunca era criada -> usuário
-- travado em "Não foi possível concluir seu cadastro". Removemos a constraint legada
-- e mantemos a do Crivo como única fonte da verdade.
alter table public.profiles drop constraint if exists profiles_role_check;

-- Garante a constraint Crivo (idempotente) caso algum ambiente não a tenha.
alter table public.profiles drop constraint if exists profiles_role_crivo_check;
alter table public.profiles add constraint profiles_role_crivo_check
  check (role = any (array['buyer','supplier','accountant','admin','member']));

-- search_path mutável em handle_new_user (advisor de segurança 0011). Recriado com
-- search_path fixo e schema-qualificado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, email, display_name, username, avatar_color)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    split_part(new.email,'@',1),
    '#0DD3C5'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

-- Funções utilitárias/trigger não devem ser chamáveis via API REST por anon.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
revoke execute on function public.is_crivo_admin() from anon;
revoke execute on function public.is_company_member(uuid, text[]) from anon;
revoke execute on function public.mark_alert_read(uuid, uuid) from anon;
