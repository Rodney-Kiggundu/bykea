-- Password reset OTP columns (Edge function `password-reset` + Resend).
-- Run in Supabase SQL Editor after email verification columns exist.

alter table public.app_users add column if not exists password_reset_code_hash text;
alter table public.app_users add column if not exists password_reset_expires_at timestamptz;
alter table public.app_users add column if not exists password_reset_sent_at timestamptz;

alter table public.shop_owners add column if not exists password_reset_code_hash text;
alter table public.shop_owners add column if not exists password_reset_expires_at timestamptz;
alter table public.shop_owners add column if not exists password_reset_sent_at timestamptz;

alter table public.driver_registrations add column if not exists password_reset_code_hash text;
alter table public.driver_registrations add column if not exists password_reset_expires_at timestamptz;
alter table public.driver_registrations add column if not exists password_reset_sent_at timestamptz;
