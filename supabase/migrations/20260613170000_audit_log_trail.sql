-- Trilha de auditoria (PRD 5.5 / 7): registra ações relevantes no servidor via
-- triggers (não dá para burlar pelo front). É a "trilha documental defensiva".
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  company_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_company_idx on public.audit_log(company_id, created_at desc);
alter table public.audit_log enable row level security;

create policy "audit_log_select" on public.audit_log for select to authenticated
  using (
    (select public.is_crivo_admin())
    or (company_id is not null and (select public.is_company_member(company_id, null)))
  );

create or replace function public.crivo_audit() returns trigger
language plpgsql security definer set search_path to '' as $$
declare v_company uuid; v_action text; v_detail jsonb := '{}'::jsonb; v_entity_id uuid;
begin
  if tg_table_name = 'documents' then
    if tg_op='UPDATE' and new.status is distinct from old.status then
      v_action := 'document_' || new.status; v_company := new.company_id; v_entity_id := new.id;
      v_detail := jsonb_build_object('tipo', new.tipo, 'filename', new.filename);
    else return new; end if;
  elsif tg_table_name = 'companies' then
    if tg_op='UPDATE' and new.listed is distinct from old.listed then
      v_action := case when new.listed then 'company_published' else 'company_unpublished' end;
      v_company := new.id; v_entity_id := new.id;
    else return new; end if;
  elsif tg_table_name = 'financial_scores' then
    v_action := 'financial_score_set'; v_company := new.company_id; v_entity_id := new.id;
    v_detail := jsonb_build_object('total', new.total);
  elsif tg_table_name = 'company_users' then
    v_action := 'member_linked'; v_company := new.company_id; v_entity_id := new.user_id;
    v_detail := jsonb_build_object('role', new.role);
  else return coalesce(new, old); end if;
  insert into public.audit_log(actor_id, action, entity, entity_id, company_id, detail)
    values (auth.uid(), v_action, tg_table_name, v_entity_id, v_company, v_detail);
  return new;
end $$;

drop trigger if exists audit_documents on public.documents;
create trigger audit_documents after update on public.documents for each row execute function public.crivo_audit();
drop trigger if exists audit_companies on public.companies;
create trigger audit_companies after update on public.companies for each row execute function public.crivo_audit();
drop trigger if exists audit_financial on public.financial_scores;
create trigger audit_financial after insert on public.financial_scores for each row execute function public.crivo_audit();
drop trigger if exists audit_company_users on public.company_users;
create trigger audit_company_users after insert on public.company_users for each row execute function public.crivo_audit();
