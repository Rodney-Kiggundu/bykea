-- Shop owner register/login — plain rows (no Supabase Auth), same pattern as app_users.
-- Run in Supabase SQL Editor after `register_login.sql` (pgcrypto optional; not required here).

create table if not exists public.shop_owners (
  id uuid primary key default gen_random_uuid(),

  business_name text not null,
  owner_full_name text not null,
  phone text not null,
  email text not null unique,
  password text not null,

  email_verified_at timestamptz,
  email_verification_code_hash text,
  email_verification_expires_at timestamptz,
  email_verification_sent_at timestamptz,

  password_reset_code_hash text,
  password_reset_expires_at timestamptz,
  password_reset_sent_at timestamptz,

  business_type text not null default 'Other',
  business_address text not null,

  -- Optional: storefront / logo (URL or browser-resized data URL from register form).
  shop_image_url text,

  created_at timestamptz not null default now()
);

-- Existing databases: add column without recreating the table.
alter table public.shop_owners add column if not exists shop_image_url text;

comment on column public.shop_owners.shop_image_url is 'Optional shop photo or logo; set from /shop-owner/register. Prefer Supabase Storage URLs in production.';

-- If you previously ran a version of this script that included license_upload_filename:
alter table public.shop_owners drop column if exists license_upload_filename;

create index if not exists shop_owners_email_lower_idx on public.shop_owners (lower(email));

comment on table public.shop_owners is 'Shop portal accounts from /shop-owner/register';

alter table public.shop_owners enable row level security;

drop policy if exists "shop_owners_insert_anon" on public.shop_owners;
create policy "shop_owners_insert_anon"
on public.shop_owners for insert to anon with check (true);

drop policy if exists "shop_owners_select_anon" on public.shop_owners;
create policy "shop_owners_select_anon"
on public.shop_owners for select to anon using (true);

drop policy if exists "shop_owners_update_anon" on public.shop_owners;
create policy "shop_owners_update_anon"
on public.shop_owners for update to anon using (true) with check (true);
