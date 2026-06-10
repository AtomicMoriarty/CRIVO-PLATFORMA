-- Revisão administrativa: admins leem perfis de usuários e baixam documentos do Storage.

drop policy if exists "admins_read_profiles_crivo" on public.profiles;
create policy "admins_read_profiles_crivo" on public.profiles
  for select to authenticated using (public.is_crivo_admin());

drop policy if exists "crivo_documents_admin_select" on storage.objects;
create policy "crivo_documents_admin_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents' and public.is_crivo_admin()
  );
