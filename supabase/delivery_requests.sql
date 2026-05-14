-- Run in Supabase SQL Editor (after `register_login.sql` / `app_users` exists)
-- Stores each delivery request when the user completes Package Details (step 2).

create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid references public.app_users (id) on delete set null,
  pickup_location text not null,
  dropoff_location text not null,
  extra_stops jsonb not null default '[]'::jsonb,
  delivery_type text not null default 'standard',
  distance_estimate text,
  package_size text,
  package_weight text,
  package_category text,
  package_notes text,
  package_photo_filename text,
  -- Customer minimum vehicle (Motorbike|Tuk-Tuk|Car); app always sends one from Package Details
  requested_vehicle_type text,
  created_at timestamptz not null default now()
);

comment on column public.delivery_requests.package_category is
  'Customer-entered package type / contents (free text; no fixed enum).';

create index if not exists delivery_requests_app_user_id_idx
  on public.delivery_requests (app_user_id);

create index if not exists delivery_requests_created_at_idx
  on public.delivery_requests (created_at desc);

comment on table public.delivery_requests is 'Customer pickup/drop + package info from request flow';
comment on column public.delivery_requests.extra_stops is 'JSON array of { "address": "..." } for stop 2+';
comment on column public.delivery_requests.app_user_id is 'Set when customer is logged in; null for guests';

alter table public.delivery_requests enable row level security;

drop policy if exists "delivery_requests_insert_anon" on public.delivery_requests;
create policy "delivery_requests_insert_anon"
on public.delivery_requests
for insert
to anon
with check (true);

drop policy if exists "delivery_requests_select_anon" on public.delivery_requests;
create policy "delivery_requests_select_anon"
on public.delivery_requests
for select
to anon
using (true);
