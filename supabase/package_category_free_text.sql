-- Package type: app stores free text in `package_category` (column type is already `text`).
-- No CHECK constraint to change. Run this on existing Supabase DBs to refresh column comments only.

comment on column public.delivery_requests.package_category is
  'Customer-entered package type / contents (free text; no fixed enum).';

comment on column public.customer_delivery_orders.package_category is
  'Snapshot of customer free-text package type at checkout (same meaning as delivery_requests.package_category).';
