-- ============================================================
-- GhostPrint Notification System Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create notifications table
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_email text not null,           -- matches profiles.username (email-based auth via NextAuth)
  title text not null,
  message text not null,
  type text default 'info',           -- 'order', 'system', 'promo', 'info'
  is_read boolean default false,
  metadata jsonb default '{}',        -- extra data like order_id, action URL, etc.
  created_at timestamp with time zone default now()
);

-- Index for fast lookups by user
create index if not exists idx_notifications_user_email on notifications(user_email);
create index if not exists idx_notifications_unread on notifications(user_email, is_read) where is_read = false;

-- 2. Add notifications_enabled to profiles (if not exists)
alter table profiles add column if not exists notifications_enabled boolean default false;

-- 3. Enable Realtime on the notifications AND orders tables
-- Only add if not already in the publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;

-- 4. RLS policies for notifications
alter table notifications enable row level security;

-- Users can view their own notifications
drop policy if exists "Users view own notifications" on notifications;
create policy "Users view own notifications" on notifications
  for select using (user_email = auth.jwt() ->> 'email');

drop policy if exists "Service role insert notifications" on notifications;
create policy "Service role insert notifications" on notifications
  for insert with check (true);

drop policy if exists "Users update own notifications" on notifications;
create policy "Users update own notifications" on notifications
  for update using (user_email = auth.jwt() ->> 'email');

drop policy if exists "Service role delete notifications" on notifications;
create policy "Service role delete notifications" on notifications
  for delete using (true);

-- 5. Auto-cleanup trigger: Keep only 10 notifications per user
-- When a new notification is inserted, delete the oldest ones beyond 10
create or replace function prune_old_notifications()
returns trigger as $$
begin
  delete from notifications
  where id in (
    select id from notifications
    where user_email = NEW.user_email
    order by created_at desc
    offset 10
  );
  return NEW;
end;
$$ language plpgsql;

-- Drop trigger if it already exists, then create
drop trigger if exists trigger_prune_notifications on notifications;
create trigger trigger_prune_notifications
  after insert on notifications
  for each row
  execute function prune_old_notifications();
