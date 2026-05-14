-- Storage bucket for driver registration documents (/driver/register).
-- Run in Supabase SQL Editor after enabling Storage. Pair with `driver_registrations.sql`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-documents',
  'driver-documents',
  true,
  15728640, -- 15 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "driver_docs_objects_select_public" on storage.objects;
create policy "driver_docs_objects_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'driver-documents');

drop policy if exists "driver_docs_objects_insert_anon" on storage.objects;
create policy "driver_docs_objects_insert_anon"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'driver-documents');

drop policy if exists "driver_docs_objects_update_anon" on storage.objects;
create policy "driver_docs_objects_update_anon"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'driver-documents')
  with check (bucket_id = 'driver-documents');

drop policy if exists "driver_docs_objects_delete_anon" on storage.objects;
create policy "driver_docs_objects_delete_anon"
  on storage.objects
  for delete
  to anon
  using (bucket_id = 'driver-documents');
