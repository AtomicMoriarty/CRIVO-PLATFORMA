-- Políticas de Storage para os buckets 'documents' (privado) e 'avatars' (público).
-- Sem elas, o RLS de storage.objects bloqueia qualquer upload/download.

drop policy if exists "crivo_documents_insert" on storage.objects;
create policy "crivo_documents_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents' and exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "crivo_documents_select" on storage.objects;
create policy "crivo_documents_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents' and exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "crivo_documents_update" on storage.objects;
create policy "crivo_documents_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'documents' and exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "crivo_documents_delete" on storage.objects;
create policy "crivo_documents_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'documents' and exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.company_id::text = (storage.foldername(name))[1]
        and cu.role in ('owner','admin')
    )
  );

drop policy if exists "crivo_avatars_read" on storage.objects;
create policy "crivo_avatars_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');

drop policy if exists "crivo_avatars_insert" on storage.objects;
create policy "crivo_avatars_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
