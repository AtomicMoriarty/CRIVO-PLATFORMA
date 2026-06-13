-- O DONO da empresa convida seu contador pelo e-mail. SECURITY DEFINER porque o dono
-- não pode ler profiles de terceiros — a função resolve o e-mail e valida tudo.
create or replace function public.invite_accountant(p_company_id uuid, p_email text)
returns text language plpgsql security definer set search_path to '' as $$
declare v_uid uuid; v_role text;
begin
  if not (public.is_company_member(p_company_id, array['owner','admin']) or public.is_crivo_admin()) then
    return 'forbidden';
  end if;
  select id, role into v_uid, v_role from public.profiles where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then return 'not_found'; end if;
  if v_role <> 'accountant' then return 'not_accountant'; end if;
  insert into public.company_users(company_id, user_id, role)
    values (p_company_id, v_uid, 'accountant')
    on conflict (company_id, user_id) do update set role = 'accountant';
  return 'ok';
end $$;

-- Lista os contadores com acesso à empresa — só para o dono/admin (gate no WHERE).
create or replace function public.list_company_accountants(p_company_id uuid)
returns table(user_id uuid, full_name text, email text)
language sql stable security definer set search_path to '' as $$
  select cu.user_id, p.full_name, p.email
  from public.company_users cu
  join public.profiles p on p.id = cu.user_id
  where cu.company_id = p_company_id and cu.role = 'accountant'
    and (public.is_company_member(p_company_id, array['owner','admin']) or public.is_crivo_admin());
$$;

revoke all on function public.invite_accountant(uuid, text) from anon;
revoke all on function public.list_company_accountants(uuid) from anon;
