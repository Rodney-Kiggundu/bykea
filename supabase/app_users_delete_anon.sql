-- Allow admin SPA (anon key) to delete customer accounts.
-- Run in Supabase SQL Editor after register_login.sql.
-- (This policy is also included at the end of register_login.sql for new installs.)
-- FKs on bookings use ON DELETE SET NULL so history rows stay anonymous.

drop policy if exists "app_users_delete_anon" on public.app_users;
create policy "app_users_delete_anon"
on public.app_users
for delete
to anon
using (true);
