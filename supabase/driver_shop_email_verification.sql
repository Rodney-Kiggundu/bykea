-- Email verification columns for driver + shop owner portals (Resend / Edge `customer-email-verify`).
-- Run in Supabase SQL Editor after driver_registrations.sql and shop_owners.sql.

alter table public.driver_registrations add column if not exists email_verified_at timestamptz;
alter table public.driver_registrations add column if not exists email_verification_code_hash text;
alter table public.driver_registrations add column if not exists email_verification_expires_at timestamptz;
alter table public.driver_registrations add column if not exists email_verification_sent_at timestamptz;

alter table public.shop_owners add column if not exists email_verified_at timestamptz;
alter table public.shop_owners add column if not exists email_verification_code_hash text;
alter table public.shop_owners add column if not exists email_verification_expires_at timestamptz;
alter table public.shop_owners add column if not exists email_verification_sent_at timestamptz;

-- Existing rows: treat as verified so logins keep working until they re-register.
update public.driver_registrations
set email_verified_at = coalesce(email_verified_at, created_at)
where email_verified_at is null;

update public.shop_owners
set email_verified_at = coalesce(email_verified_at, created_at)
where email_verified_at is null;
