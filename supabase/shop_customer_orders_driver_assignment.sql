-- Driver pickup + delivery for shop orders (status "ready for delivery" on /shop-owner/orders).
-- Run after: shop_customer_orders.sql, shop_customer_order_lines.sql, shop_owners.sql, driver_registrations.sql, driver_booking_assignment.sql

alter table public.shop_customer_orders
  add column if not exists assigned_driver_id uuid references public.driver_registrations (id) on delete set null;

alter table public.shop_customer_orders
  add column if not exists rejected_driver_ids uuid[] not null default '{}'::uuid[];

alter table public.shop_customer_orders
  add column if not exists assigned_at timestamptz;

alter table public.shop_customer_orders
  add column if not exists completed_at timestamptz;

create index if not exists shop_customer_orders_assigned_driver_id_idx
  on public.shop_customer_orders (assigned_driver_id);

create index if not exists shop_customer_orders_open_driver_idx
  on public.shop_customer_orders (status, assigned_driver_id, placed_at desc);

drop policy if exists "shop_customer_orders_update_anon" on public.shop_customer_orders;
create policy "shop_customer_orders_update_anon"
on public.shop_customer_orders
for update
to anon
using (true)
with check (true);

comment on column public.shop_customer_orders.assigned_driver_id is 'driver_registrations.id when a driver accepted this shop delivery';
comment on column public.shop_customer_orders.rejected_driver_ids is 'Drivers who declined this shop delivery offer';
