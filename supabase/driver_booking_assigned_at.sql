-- When the driver accepts, `assigned_at` is set by the app (see driverAcceptOffer).
-- Driver home "recent jobs" uses this instead of `created_at` so old ride requests do not stay on top.

alter table public.customer_delivery_orders
  add column if not exists assigned_at timestamptz;

alter table public.taxi_bookings
  add column if not exists assigned_at timestamptz;

alter table public.tuk_tuk_bookings
  add column if not exists assigned_at timestamptz;

comment on column public.customer_delivery_orders.assigned_at is 'When assigned_driver_id was set (driver accepted)';
comment on column public.taxi_bookings.assigned_at is 'When assigned_driver_id was set (driver confirmed)';
comment on column public.tuk_tuk_bookings.assigned_at is 'When assigned_driver_id was set (driver confirmed)';

-- Approximate accept time for rows already assigned before this column existed.
update public.customer_delivery_orders
set assigned_at = coalesce(assigned_at, created_at)
where assigned_driver_id is not null and assigned_at is null;

update public.taxi_bookings
set assigned_at = coalesce(assigned_at, created_at)
where assigned_driver_id is not null and assigned_at is null;

update public.tuk_tuk_bookings
set assigned_at = coalesce(assigned_at, created_at)
where assigned_driver_id is not null and assigned_at is null;
