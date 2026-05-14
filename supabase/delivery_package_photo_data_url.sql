-- Optional snapshot of the customer's package photo (JPEG data URL) for drivers.
-- Run in Supabase SQL Editor after `customer_delivery_orders.sql`.

alter table public.customer_delivery_orders
  add column if not exists package_photo_data_url text;

comment on column public.customer_delivery_orders.package_photo_data_url is
  'Compressed JPEG data URL from customer package photo (driver active delivery / support).';
