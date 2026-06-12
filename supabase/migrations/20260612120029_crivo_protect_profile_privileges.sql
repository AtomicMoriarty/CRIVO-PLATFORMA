-- Fecha o último vetor de escalonamento: a policy profiles_update permite ao
-- usuário editar a própria linha, mas role/plan não podem ser auto-promovidos
-- (role='admin' + plan='premium' = is_crivo_admin() = acesso total). O trigger
-- coage os campos sensíveis quando a escrita vem de anon/authenticated não-admin.
-- service_role (stripe-webhook), postgres (migrations/dashboard) e o trigger de
-- signup (SECURITY DEFINER do postgres) não são afetados.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('anon','authenticated') and not public.is_crivo_admin() then
    if tg_op = 'INSERT' then
      if new.role is null or new.role not in ('buyer','supplier','accountant') then
        new.role := 'buyer';
      end if;
      new.plan := 'free';
    else
      if new.role is distinct from old.role and new.role not in ('buyer','supplier','accountant') then
        new.role := old.role;
      end if;
      if new.plan is distinct from old.plan then
        new.plan := old.plan;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- mark_alert_read confiava no p_user_id enviado pelo cliente. Passa a usar
-- auth.uid() (parâmetro mantido por compatibilidade, mas ignorado) e só marca
-- alertas que o usuário realmente pode ver.
create or replace function public.mark_alert_read(p_alert_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.alerts a
  set read_by = array_append(a.read_by, auth.uid())
  where a.id = p_alert_id
    and auth.uid() is not null
    and not (auth.uid() = any(a.read_by))
    and exists (
      select 1 from public.company_users cu
      left join public.portfolios p on p.buyer_id = cu.company_id
      where cu.user_id = auth.uid()
        and (cu.company_id = a.company_id or p.supplier_id = a.company_id)
    );
$$;
