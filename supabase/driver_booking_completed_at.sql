-- Run in Supabase SQL Editor after `driver_booking_assignment.sql`.
-- Enables earnings/history: when a driver finishes a job, we record time and parcel terminal status.

alter table public.customer_delivery_orders
  add column if not exists completed_at timestamptz;

alter table public.taxi_bookings
  add column if not exists completed_at timestamptz;

alter table public.tuk_tuk_bookings
  add column if not exists completed_at timestamptz;

alter table public.customer_delivery_orders drop constraint if exists customer_delivery_orders_status_chk;

alter table public.customer_delivery_orders
  add constraint customer_delivery_orders_status_chk check (
    status in ('placed', 'paid', 'cancelled', 'assigned', 'delivered')
  );

comment on column public.customer_delivery_orders.completed_at is 'Set when driver marks parcel delivered / journey ended';
comment on column public.taxi_bookings.completed_at is 'Set when driver ends journey (status completed)';
comment on column public.tuk_tuk_bookings.completed_at is 'Set when driver ends journey (status completed)';
