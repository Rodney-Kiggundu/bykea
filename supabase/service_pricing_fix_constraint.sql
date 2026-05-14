-- Fix ERROR 23514: CHECK constraint violated by existing rows.
-- Run this whole block in Supabase SQL Editor if adding service_pricing_service_type_chk fails.

alter table public.service_pricing
  drop constraint if exists service_pricing_service_type_chk;

delete from public.service_pricing
where service_type not in (
  'delivery',
  'parcel',
  'taxi',
  'tuk_tuk',
  'delivery_motorbike',
  'delivery_tuk_tuk',
  'delivery_car'
);

alter table public.service_pricing
  add constraint service_pricing_service_type_chk check (
    service_type in (
      'delivery',
      'parcel',
      'taxi',
      'tuk_tuk',
      'delivery_motorbike',
      'delivery_tuk_tuk',
      'delivery_car'
    )
  );
