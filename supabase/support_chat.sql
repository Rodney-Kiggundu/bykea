-- Customer ↔ admin support chat (plain tables, anon RLS — same pattern as app_users / orders).
-- Run in Supabase SQL Editor after `register_login.sql` (FK to `app_users`).
--
-- SECURITY NOTE: Open SELECT/INSERT policies let any client with the anon key read/write all rows.
-- Before production, switch to Supabase Auth JWT (auth.uid()), or service_role for admin writes,
-- and scope customer reads to their own conversation_id (e.g. membership table or signed token).

-- ---------------------------------------------------------------------------
-- Conversations (one thread per support case; link to customer when known)
-- ---------------------------------------------------------------------------
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),

  -- Logged-in customer (optional)
  app_user_id uuid references public.app_users (id) on delete set null,

  -- When the user is not logged in, the app can stash a random id in localStorage + pass it here
  client_device_key uuid,

  title text,
  customer_name text,
  customer_phone text,
  customer_email text,

  status text not null default 'open',

  last_message_preview text,
  last_message_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint support_conversations_status_chk check (
    status in ('open', 'pending_admin', 'answered', 'resolved', 'archived')
  )
);

create index if not exists support_conversations_app_user_id_idx
  on public.support_conversations (app_user_id, updated_at desc);

create index if not exists support_conversations_device_key_idx
  on public.support_conversations (client_device_key)
  where client_device_key is not null;

create index if not exists support_conversations_updated_at_idx
  on public.support_conversations (updated_at desc);

comment on table public.support_conversations is 'Customer support thread; app creates row then appends support_messages';
comment on column public.support_conversations.client_device_key is 'Optional stable id from localStorage when app_user_id is null';
comment on column public.support_conversations.status is 'open | pending_admin (customer waiting) | answered (admin replied) | resolved | archived';

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null references public.support_conversations (id) on delete cascade,

  sender_role text not null,
  body text not null,

  -- When sender is customer and you have a profile row
  author_app_user_id uuid references public.app_users (id) on delete set null,

  -- Admin display name free text (no admin users table in this repo yet)
  admin_display_name text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint support_messages_sender_role_chk check (
    sender_role in ('customer', 'admin', 'system')
  ),
  constraint support_messages_body_chk check (char_length(trim(body)) > 0)
);

create index if not exists support_messages_conversation_time_idx
  on public.support_messages (conversation_id, created_at asc);

comment on table public.support_messages is 'One row per chat line; customers and admins both insert with anon key until you harden RLS';
comment on column public.support_messages.admin_display_name is 'Shown in customer app when sender_role = admin';

-- ---------------------------------------------------------------------------
-- Keep conversation summary in sync after each message
-- ---------------------------------------------------------------------------
create or replace function public.support_after_message_insert()
returns trigger
language plpgsql
as $$
declare
  st text;
begin
  select c.status into st
  from public.support_conversations c
  where c.id = new.conversation_id;

  if not found then
    return new;
  end if;

  if new.sender_role = 'admin' or new.sender_role = 'system' then
    update public.support_conversations
    set
      updated_at = now(),
      last_message_at = now(),
      last_message_preview = left(trim(both from new.body), 200),
      status = case
        when new.sender_role = 'system' then status
        when st = 'archived' then st
        else 'answered'
      end
    where id = new.conversation_id;
  else
    -- customer
    update public.support_conversations
    set
      updated_at = now(),
      last_message_at = now(),
      last_message_preview = left(trim(both from new.body), 200),
      status = case
        when st = 'resolved' then 'open'
        when st = 'answered' then 'pending_admin'
        when st = 'archived' then st
        else coalesce(nullif(st, ''), 'open')
      end
    where id = new.conversation_id;
  end if;

  return new;
end;
$$;

drop trigger if exists support_messages_after_insert on public.support_messages;
create trigger support_messages_after_insert
  after insert on public.support_messages
  for each row
  execute function public.support_after_message_insert();

create or replace function public.support_conversations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_conversations_set_updated_at on public.support_conversations;
create trigger support_conversations_set_updated_at
  before update on public.support_conversations
  for each row
  execute function public.support_conversations_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security (anon — matches other public tables in this project)
-- ---------------------------------------------------------------------------
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_conversations_select_anon" on public.support_conversations;
create policy "support_conversations_select_anon"
on public.support_conversations
for select
to anon
using (true);

drop policy if exists "support_conversations_insert_anon" on public.support_conversations;
create policy "support_conversations_insert_anon"
on public.support_conversations
for insert
to anon
with check (true);

drop policy if exists "support_conversations_update_anon" on public.support_conversations;
create policy "support_conversations_update_anon"
on public.support_conversations
for update
to anon
using (true)
with check (true);

drop policy if exists "support_conversations_delete_anon" on public.support_conversations;
create policy "support_conversations_delete_anon"
on public.support_conversations
for delete
to anon
using (true);

drop policy if exists "support_messages_select_anon" on public.support_messages;
create policy "support_messages_select_anon"
on public.support_messages
for select
to anon
using (true);

drop policy if exists "support_messages_insert_anon" on public.support_messages;
create policy "support_messages_insert_anon"
on public.support_messages
for insert
to anon
with check (true);

drop policy if exists "support_messages_update_anon" on public.support_messages;
create policy "support_messages_update_anon"
on public.support_messages
for update
to anon
using (true)
with check (true);

drop policy if exists "support_messages_delete_anon" on public.support_messages;
create policy "support_messages_delete_anon"
on public.support_messages
for delete
to anon
using (true);

-- Optional realtime: Dashboard → Database → Replication → enable `support_messages` (and optionally
-- `support_conversations`) for postgres_changes subscriptions from the React app.
