-- Shop owner wallet withdrawal requests.
-- Run after: shop_owners.sql

create table if not exists public.shop_owner_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  shop_owner_id uuid not null references public.shop_owners (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  admin_note text
);

create index if not exists shop_owner_withdrawal_requests_owner_idx
  on public.shop_owner_withdrawal_requests (shop_owner_id, requested_at desc);

create index if not exists shop_owner_withdrawal_requests_status_idx
  on public.shop_owner_withdrawal_requests (status, requested_at desc);

alter table public.shop_owner_withdrawal_requests enable row level security;

drop policy if exists "shop_owner_withdrawal_requests_insert_anon" on public.shop_owner_withdrawal_requests;
create policy "shop_owner_withdrawal_requests_insert_anon"
on public.shop_owner_withdrawal_requests for insert to anon with check (true);

drop policy if exists "shop_owner_withdrawal_requests_select_anon" on public.shop_owner_withdrawal_requests;
create policy "shop_owner_withdrawal_requests_select_anon"
on public.shop_owner_withdrawal_requests for select to anon using (true);

drop policy if exists "shop_owner_withdrawal_requests_update_anon" on public.shop_owner_withdrawal_requests;
create policy "shop_owner_withdrawal_requests_update_anon"
on public.shop_owner_withdrawal_requests for update to anon using (true) with check (true);
