-- Driver wallet withdrawal requests.
-- Run after: driver_registrations.sql

create table if not exists public.driver_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_registrations (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  admin_note text
);

create index if not exists driver_withdrawal_requests_driver_idx
  on public.driver_withdrawal_requests (driver_id, requested_at desc);

create index if not exists driver_withdrawal_requests_status_idx
  on public.driver_withdrawal_requests (status, requested_at desc);

alter table public.driver_withdrawal_requests enable row level security;

drop policy if exists "driver_withdrawal_requests_insert_anon" on public.driver_withdrawal_requests;
create policy "driver_withdrawal_requests_insert_anon"
on public.driver_withdrawal_requests for insert to anon with check (true);

drop policy if exists "driver_withdrawal_requests_select_anon" on public.driver_withdrawal_requests;
create policy "driver_withdrawal_requests_select_anon"
on public.driver_withdrawal_requests for select to anon using (true);

drop policy if exists "driver_withdrawal_requests_update_anon" on public.driver_withdrawal_requests;
create policy "driver_withdrawal_requests_update_anon"
on public.driver_withdrawal_requests for update to anon using (true) with check (true);
