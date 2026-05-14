-- Paynow tracking fields for shop checkout orders.
-- Run after: shop_customer_orders.sql

alter table public.shop_customer_orders
  add column if not exists payment_gateway text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists paynow_reference text,
  add column if not exists paynow_poll_url text,
  add column if not exists paynow_redirect_url text,
  add column if not exists payment_started_at timestamptz,
  add column if not exists payment_completed_at timestamptz;

alter table public.shop_customer_orders drop constraint if exists shop_customer_orders_payment_status_chk;
alter table public.shop_customer_orders
  add constraint shop_customer_orders_payment_status_chk check (
    payment_status in ('pending', 'paid', 'failed', 'cancelled')
  );

create index if not exists shop_customer_orders_payment_status_idx
  on public.shop_customer_orders (payment_status, placed_at desc);

create index if not exists shop_customer_orders_paynow_reference_idx
  on public.shop_customer_orders (paynow_reference);

comment on column public.shop_customer_orders.payment_gateway is 'Gateway used for payment, e.g. paynow';
comment on column public.shop_customer_orders.payment_status is 'pending | paid | failed | cancelled';
comment on column public.shop_customer_orders.paynow_reference is 'Paynow merchant reference used to initiate transaction';
comment on column public.shop_customer_orders.paynow_poll_url is 'Paynow poll URL to verify transaction state';
