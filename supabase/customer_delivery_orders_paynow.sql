-- Paynow tracking fields for customer delivery orders (mirror shop_customer_orders_paynow.sql).
-- Run after: customer_delivery_orders.sql

alter table public.customer_delivery_orders
  add column if not exists payment_gateway text,
  add column if not exists payment_status text,
  add column if not exists paynow_reference text,
  add column if not exists paynow_poll_url text,
  add column if not exists paynow_redirect_url text,
  add column if not exists payment_started_at timestamptz,
  add column if not exists payment_completed_at timestamptz;

alter table public.customer_delivery_orders drop constraint if exists customer_delivery_orders_payment_status_chk;
alter table public.customer_delivery_orders
  add constraint customer_delivery_orders_payment_status_chk check (
    payment_status is null or payment_status in ('pending', 'paid', 'failed', 'cancelled')
  );

create index if not exists customer_delivery_orders_payment_status_idx
  on public.customer_delivery_orders (payment_status, created_at desc);

create index if not exists customer_delivery_orders_paynow_reference_idx
  on public.customer_delivery_orders (paynow_reference);

comment on column public.customer_delivery_orders.payment_gateway is 'Gateway used for payment, e.g. paynow';
comment on column public.customer_delivery_orders.payment_status is 'null until online payment; then pending | paid | failed | cancelled';
