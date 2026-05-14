-- Two-way trip reviews (customer -> driver, driver -> customer)
-- Run after register_login.sql, driver_registrations.sql, driver_booking_assignment.sql

create table if not exists public.trip_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_table text,
  booking_id uuid,

  reviewer_role text not null check (reviewer_role in ('customer', 'driver')),
  reviewer_app_user_id uuid references public.app_users (id) on delete set null,
  reviewer_driver_id uuid references public.driver_registrations (id) on delete set null,

  reviewee_role text not null check (reviewee_role in ('customer', 'driver')),
  reviewee_app_user_id uuid references public.app_users (id) on delete set null,
  reviewee_driver_id uuid references public.driver_registrations (id) on delete set null,

  rating int not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now()
);

create index if not exists trip_reviews_booking_idx on public.trip_reviews (booking_table, booking_id);
create index if not exists trip_reviews_reviewer_customer_idx on public.trip_reviews (reviewer_app_user_id, created_at desc);
create index if not exists trip_reviews_reviewer_driver_idx on public.trip_reviews (reviewer_driver_id, created_at desc);
create index if not exists trip_reviews_reviewee_customer_idx on public.trip_reviews (reviewee_app_user_id, created_at desc);
create index if not exists trip_reviews_reviewee_driver_idx on public.trip_reviews (reviewee_driver_id, created_at desc);

alter table public.trip_reviews enable row level security;

drop policy if exists "trip_reviews_insert_anon" on public.trip_reviews;
create policy "trip_reviews_insert_anon"
on public.trip_reviews for insert to anon with check (true);

drop policy if exists "trip_reviews_select_anon" on public.trip_reviews;
create policy "trip_reviews_select_anon"
on public.trip_reviews for select to anon using (true);
