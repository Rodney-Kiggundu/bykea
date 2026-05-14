-- Allow Mini Bus as a taxi_bookings.vehicle_type (run if you already applied taxi_bookings.sql before minibus existed).

alter table public.taxi_bookings drop constraint if exists taxi_bookings_vehicle_type_chk;

alter table public.taxi_bookings add constraint taxi_bookings_vehicle_type_chk check (
  vehicle_type in ('bicycle', 'tuktuk', 'car', 'minibus')
);

comment on column public.taxi_bookings.vehicle_type is 'Customer choice: bicycle | tuktuk | car | minibus';
