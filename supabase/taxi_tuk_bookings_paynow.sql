-- Paynow / online payment tracking for taxi + Tuk-Tuk (mirror customer_delivery_orders_paynow.sql).
-- Run after taxi_bookings.sql, tuk_tuk_bookings.sql, and taxi_tuk_payment_method.sql.

alter table public.taxi_bookings
  add column if not exists payment_gateway text,
  add column if not exists payment_status text,
  add column if not exists paynow_reference text,
  add column if not exists paynow_poll_url text,
  add column if not exists paynow_redirect_url text,
  add column if not exists payment_started_at timestamptz,
  add column if not exists payment_completed_at timestamptz;

alter table public.taxi_bookings drop constraint if exists taxi_bookings_payment_status_chk;
alter table public.taxi_bookings
  add constraint taxi_bookings_payment_status_chk check (
    payment_status is null or payment_status in ('pending', 'paid', 'failed', 'cancelled')
  );

create index if not exists taxi_bookings_payment_status_idx
  on public.taxi_bookings (payment_status, created_at desc);

create index if not exists taxi_bookings_paynow_reference_idx
  on public.taxi_bookings (paynow_reference);

comment on column public.taxi_bookings.payment_gateway is 'Gateway used for payment, e.g. paynow';
comment on column public.taxi_bookings.payment_status is 'null until online payment; then pending | paid | failed | cancelled';

alter table public.tuk_tuk_bookings
  add column if not exists payment_gateway text,
  add column if not exists payment_status text,
  add column if not exists paynow_reference text,
  add column if not exists paynow_poll_url text,
  add column if not exists paynow_redirect_url text,
  add column if not exists payment_started_at timestamptz,
  add column if not exists payment_completed_at timestamptz;

alter table public.tuk_tuk_bookings drop constraint if exists tuk_tuk_bookings_payment_status_chk;
alter table public.tuk_tuk_bookings
  add constraint tuk_tuk_bookings_payment_status_chk check (
    payment_status is null or payment_status in ('pending', 'paid', 'failed', 'cancelled')
  );

create index if not exists tuk_tuk_bookings_payment_status_idx
  on public.tuk_tuk_bookings (payment_status, created_at desc);

create index if not exists tuk_tuk_bookings_paynow_reference_idx
  on public.tuk_tuk_bookings (paynow_reference);

notify pgrst, 'reload schema';
