-- Allow admin SPA (anon key) to delete shop owner accounts.
-- Run in Supabase SQL Editor after shop_owners.sql.
-- Note: FK on shop_customer_order_lines is RESTRICT — delete fails if orders reference this shop.
--       FK on shop_products is CASCADE — their products are removed with the owner.

drop policy if exists "shop_owners_delete_anon" on public.shop_owners;
create policy "shop_owners_delete_anon"
on public.shop_owners
for delete
to anon
using (true);
