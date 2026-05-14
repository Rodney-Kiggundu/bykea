-- Driver assignment on customer bookings (parcel / taxi / tuk-tuk).
-- Run after: driver_registrations.sql, customer_delivery_orders.sql, taxi_bookings.sql, tuk_tuk_bookings.sql
--
-- Flow: customer inserts row → drivers see it when assigned_driver_id is null and status is "open".
-- Accept: set assigned_driver_id + advance status. Reject: append driver uuid to rejected_driver_ids.

-- ---------- customer_delivery_orders ----------
alter table public.customer_delivery_orders
  add column if not exists assigned_driver_id uuid references public.driver_registrations (id) on delete set null;

alter table public.customer_delivery_orders
  add column if not exists rejected_driver_ids uuid[] not null default '{}'::uuid[];

alter table public.customer_delivery_orders drop constraint if exists customer_delivery_orders_status_chk;

alter table public.customer_delivery_orders
  add constraint customer_delivery_orders_status_chk check (
    status in ('placed', 'paid', 'cancelled', 'assigned')
  );

create index if not exists customer_delivery_orders_assigned_driver_id_idx
  on public.customer_delivery_orders (assigned_driver_id);

create index if not exists customer_delivery_orders_open_driver_idx
  on public.customer_delivery_orders (status, assigned_driver_id, created_at desc);

drop policy if exists "customer_delivery_orders_update_anon" on public.customer_delivery_orders;

create policy "customer_delivery_orders_update_anon"
on public.customer_delivery_orders
for update
to anon
using (true)
with check (true);

comment on column public.customer_delivery_orders.assigned_driver_id is 'driver_registrations.id when a driver accepted this parcel';
comment on column public.customer_delivery_orders.rejected_driver_ids is 'Drivers who declined; they no longer see this offer';

-- ---------- taxi_bookings ----------
alter table public.taxi_bookings
  add column if not exists assigned_driver_id uuid references public.driver_registrations (id) on delete set null;

alter table public.taxi_bookings
  add column if not exists rejected_driver_ids uuid[] not null default '{}'::uuid[];

create index if not exists taxi_bookings_assigned_driver_id_idx on public.taxi_bookings (assigned_driver_id);

drop policy if exists "taxi_bookings_update_anon" on public.taxi_bookings;

create policy "taxi_bookings_update_anon"
on public.taxi_bookings
for update
to anon
using (true)
with check (true);

comment on column public.taxi_bookings.assigned_driver_id is 'driver_registrations.id when a driver confirmed this ride';

-- ---------- tuk_tuk_bookings ----------
alter table public.tuk_tuk_bookings
  add column if not exists assigned_driver_id uuid references public.driver_registrations (id) on delete set null;

alter table public.tuk_tuk_bookings
  add column if not exists rejected_driver_ids uuid[] not null default '{}'::uuid[];

create index if not exists tuk_tuk_bookings_assigned_driver_id_idx on public.tuk_tuk_bookings (assigned_driver_id);

drop policy if exists "tuk_tuk_bookings_update_anon" on public.tuk_tuk_bookings;

create policy "tuk_tuk_bookings_update_anon"
on public.tuk_tuk_bookings
for update
to anon
using (true)
with check (true);

comment on column public.tuk_tuk_bookings.assigned_driver_id is 'driver_registrations.id when a driver confirmed this ride';
