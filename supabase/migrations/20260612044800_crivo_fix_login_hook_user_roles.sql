-- HOTFIX CRÍTICO: o hook de access token (custom_access_token_hook) referenciava
-- public.user_roles, removida em 20260612043630_crivo_remove_duplicate_admin_system.
-- Como o hook roda em TODO login/refresh de token, isso derrubava a autenticação
-- inteira (erro "relation public.user_roles does not exist"). Recriado lendo de
-- public.profiles e com guarda de exceção para que uma falha interna nunca mais
-- impeça a emissão de tokens.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  claims jsonb;
  user_role text;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  begin
    select p.role into user_role
    from public.profiles p
    where p.id = (event->>'user_id')::uuid
      and p.role = 'admin'
    limit 1;
  exception when others then
    user_role := null;
  end;
  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  else
    claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;
