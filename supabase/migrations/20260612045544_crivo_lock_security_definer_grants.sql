-- Advisors 0028/0029: funções SECURITY DEFINER expostas via /rest/v1/rpc.
-- O EXECUTE default vai para PUBLIC (do qual anon e authenticated herdam), então
-- revogamos de PUBLIC e concedemos de volta só a quem precisa.

-- Funções de trigger/event-trigger: ninguém deve chamar via API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Helpers usados dentro das policies de RLS: precisam de EXECUTE para o papel
-- authenticated (avaliação das policies), mas não para anon (as policies de anon
-- não os utilizam).
revoke execute on function public.is_crivo_admin() from public, anon;
grant execute on function public.is_crivo_admin() to authenticated;

revoke execute on function public.is_company_member(uuid, text[]) from public, anon;
grant execute on function public.is_company_member(uuid, text[]) to authenticated;

-- RPC chamada apenas por usuários logados (marcar alerta como lido).
revoke execute on function public.mark_alert_read(uuid, uuid) from public, anon;
grant execute on function public.mark_alert_read(uuid, uuid) to authenticated;
