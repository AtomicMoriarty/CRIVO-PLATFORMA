-- Índices para FKs usadas em joins/filtros frequentes (dashboard, diretório, monitoramento)
create index if not exists companies_user_id_idx on public.companies (user_id);
create index if not exists company_users_user_id_idx on public.company_users (user_id);
create index if not exists documents_company_id_idx on public.documents (company_id);
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);
create index if not exists portfolios_supplier_id_idx on public.portfolios (supplier_id);
create index if not exists portfolios_added_by_idx on public.portfolios (added_by);
create index if not exists alerts_company_id_idx on public.alerts (company_id);

-- Bucket "avatars" é público (servido via URL pública, sem precisar de policy de
-- SELECT no storage.objects) e não está em uso pelo frontend. A policy
-- "crivo_avatars_read" permitia listar todos os arquivos do bucket via API.
drop policy if exists crivo_avatars_read on storage.objects;
