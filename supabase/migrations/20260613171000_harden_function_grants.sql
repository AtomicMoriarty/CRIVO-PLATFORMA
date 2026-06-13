-- Tira o grant default PUBLIC (que dá acesso ao anon) e concede só ao authenticated.
-- crivo_audit é função de trigger — ninguém chama direto (o trigger roda como dono).
revoke all on function public.crivo_audit() from public;
revoke all on function public.company_has_members(uuid) from public;
grant execute on function public.company_has_members(uuid) to authenticated;
revoke all on function public.invite_accountant(uuid, text) from public;
grant execute on function public.invite_accountant(uuid, text) to authenticated;
revoke all on function public.list_company_accountants(uuid) from public;
grant execute on function public.list_company_accountants(uuid) to authenticated;
