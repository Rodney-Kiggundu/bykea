-- Email verification for table-based customers (`app_users`).
-- Run in Supabase SQL Editor after register_login.sql.

alter table public.app_users add column if not exists email_verified_at timestamptz;
alter table public.app_users add column if not exists email_verification_code_hash text;
alter table public.app_users add column if not exists email_verification_expires_at timestamptz;
alter table public.app_users add column if not exists email_verification_sent_at timestamptz;

-- Existing accounts: treat as already verified so logins keep working.
update public.app_users
set email_verified_at = coalesce(email_verified_at, created_at)
where email_verified_at is null;
