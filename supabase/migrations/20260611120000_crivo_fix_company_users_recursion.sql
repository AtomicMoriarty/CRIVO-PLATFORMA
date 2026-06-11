-- Corrige recursão infinita no RLS de company_users (erro 42P17).
-- A política referenciava a própria tabela; a checagem de membro vai para
-- uma função SECURITY DEFINER, que consulta company_users sem reativar o RLS.

create or replace function public.is_company_member(cid uuid, allowed_roles text[] default null)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_users cu
    where cu.company_id = cid
      and cu.user_id = auth.uid()
      and (allowed_roles is null or cu.role = any(allowed_roles))
  );
$$;

revoke all on function public.is_company_member(uuid, text[]) from public, anon;
grant execute on function public.is_company_member(uuid, text[]) to authenticated;

drop policy if exists "company_users_members_crivo" on public.company_users;
create policy "company_users_members_crivo" on public.company_users
  for all to authenticated
  using (
    user_id = auth.uid()
    or public.is_company_member(company_id, array['owner','admin'])
  )
  with check (true);
