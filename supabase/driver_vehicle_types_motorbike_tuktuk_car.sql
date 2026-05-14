-- Run in Supabase SQL Editor on existing databases.
-- Removes Bicycle / Van from allowed driver types; remaps legacy rows.
--
-- IMPORTANT: add parcel columns before any UPDATE that uses them (avoids "column does not exist").

-- ---------- Ensure columns exist first ----------
alter table public.delivery_requests
  add column if not exists requested_vehicle_type text;

alter table public.customer_delivery_orders
  add column if not exists requested_vehicle_type text;

comment on column public.delivery_requests.requested_vehicle_type is
  'Customer minimum vehicle: Motorbike | Tuk-Tuk | Car (app requires a choice).';

comment on column public.customer_delivery_orders.requested_vehicle_type is
  'Snapshot of customer minimum vehicle; drivers must meet tier (>=) and weight capacity.';

-- ---------- Normalize legacy requested_vehicle_type (safe if column was null-only) ----------
update public.delivery_requests
set requested_vehicle_type = 'Motorbike'
where requested_vehicle_type in ('Bicycle', 'Bike');

update public.delivery_requests
set requested_vehicle_type = 'Car'
where requested_vehicle_type = 'Van';

update public.customer_delivery_orders
set requested_vehicle_type = 'Motorbike'
where requested_vehicle_type in ('Bicycle', 'Bike');

update public.customer_delivery_orders
set requested_vehicle_type = 'Car'
where requested_vehicle_type = 'Van';

-- ---------- Remap legacy driver vehicle_type ----------
update public.driver_registrations
set vehicle_type = 'Motorbike'
where vehicle_type in ('Bicycle', 'Bike');

update public.driver_registrations
set vehicle_type = 'Car'
where vehicle_type = 'Van';

-- ---------- Tighten CHECK to Motorbike | Tuk-Tuk | Car ----------
alter table public.driver_registrations
  drop constraint if exists driver_registrations_vehicle_type_chk;

alter table public.driver_registrations
  add constraint driver_registrations_vehicle_type_chk check (
    vehicle_type in ('Motorbike', 'Tuk-Tuk', 'Car')
  );

comment on column public.driver_registrations.vehicle_type is 'Motorbike | Tuk-Tuk | Car';
