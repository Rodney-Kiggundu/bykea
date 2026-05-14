-- Supabase Storage: bucket + policies for shop / product images.
-- Run in Supabase Dashboard → SQL Editor (uses built-in `storage` schema).
--
-- After this runs, upload from the app with the anon key, e.g.:
--   await supabase.storage.from('shop-media').upload('owners/<uuid>/logo.jpg', file, { upsert: true })
-- Then store the public URL in `shop_owners.shop_image_url` or product image fields (getPublicUrl).
--
-- Security: policies below allow anon read/write on this bucket only — fine for demos.
-- For production, prefer Supabase Auth + policies on auth.uid(), or signed uploads via an Edge Function.

-- ----- Bucket -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-media',
  'shop-media',
  true,
  10485760, -- 10 MB per object (adjust as needed)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----- Policies on storage.objects (RLS is enabled by default) -----
-- Public read (so getPublicUrl() works without a session).
drop policy if exists "shop_media_objects_select_public" on storage.objects;
create policy "shop_media_objects_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'shop-media');

-- Anonymous uploads (matches table RLS using REACT_APP_SUPABASE_ANON_KEY).
drop policy if exists "shop_media_objects_insert_anon" on storage.objects;
create policy "shop_media_objects_insert_anon"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'shop-media');

-- Allow replace / upsert from the client (requires update when using upsert: true).
drop policy if exists "shop_media_objects_update_anon" on storage.objects;
create policy "shop_media_objects_update_anon"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'shop-media')
  with check (bucket_id = 'shop-media');

-- Optional: let the app delete an old file when replacing an image.
drop policy if exists "shop_media_objects_delete_anon" on storage.objects;
create policy "shop_media_objects_delete_anon"
  on storage.objects
  for delete
  to anon
  using (bucket_id = 'shop-media');
