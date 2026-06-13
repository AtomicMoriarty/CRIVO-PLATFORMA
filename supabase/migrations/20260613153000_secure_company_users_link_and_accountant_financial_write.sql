-- Helper SECURITY DEFINER: a empresa já tem algum membro? (bypassa RLS — senão a
-- visibilidade de RLS esconde o dono do atacante e o "not exists" passa errado).
create or replace function public.company_has_members(cid uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.company_users cu where cu.company_id = cid);
$$;

-- Fecha brecha: usuário autenticado só pode se AUTO-vincular a uma empresa que ELE
-- criou (companies.user_id = ele) OU que ainda não tem nenhum membro (primeiro a
-- entrar). Owners/admin da empresa continuam adicionando pessoas; admin Crivo idem.
-- Antes, o clausula "user_id = auth.uid()" permitia se vincular a QUALQUER empresa e
-- ler documentos/scores privados dela (e burlaria o gate pago do financial_scores).
alter policy "company_users_insert" on public.company_users
  with check (
    (
      user_id = (select auth.uid())
      and (
        exists (select 1 from public.companies c
                where c.id = company_users.company_id and c.user_id = (select auth.uid()))
        or not public.company_has_members(company_users.company_id)
      )
    )
    or (select public.is_company_member(company_users.company_id, array['owner','admin']))
    or (select public.is_crivo_admin())
  );

-- Contador parceiro pode registrar a saúde financeira dos CLIENTES dele (vinculado
-- via company_users com role 'accountant'). A escrita de admin continua valendo.
create policy "financial_scores_accountant_write" on public.financial_scores
  for insert to authenticated
  with check (
    exists (select 1 from public.company_users cu
            where cu.company_id = financial_scores.company_id
              and cu.user_id = (select auth.uid())
              and cu.role = 'accountant')
  );
