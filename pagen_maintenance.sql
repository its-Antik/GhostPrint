-- ============================================
-- Pagen Operation 1: "Pagen Maintenance" 
-- Auto-cleanup of completed/expired orders
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create the global_settings table (also used by Kill-Switch)
create table if not exists global_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamp with time zone default now()
);

-- Insert default settings
insert into global_settings (key, value)
values 
  ('is_system_active', '{"active": true, "message": "The Grid is undergoing scheduled maintenance.", "estimated_uptime": "4 hours"}'::jsonb),
  ('cleanup_config', '{"retention_hours": 24, "statuses": ["delivered", "cancelled"]}'::jsonb)
on conflict (key) do nothing;

-- Allow public read access (anyone can check if system is online)
alter table global_settings enable row level security;

create policy "Anyone can read settings" on global_settings
  for select using (true);

-- Only service_role can modify settings (admin only via API)
create policy "Service role can modify settings" on global_settings
  for all using (true) with check (true);

grant select on global_settings to anon;
grant select on global_settings to authenticated;
grant all on global_settings to service_role;

-- 2. Create the cleanup function
-- Deletes orders with status 'delivered' or 'cancelled' that are older than 24 hours
create or replace function cleanup_old_orders()
returns void
language plpgsql
security definer
as $$
declare
  retention interval := interval '24 hours';
  deleted_count integer;
begin
  -- Delete old delivered/cancelled orders
  delete from orders
  where status in ('delivered', 'cancelled')
    and updated_at < now() - retention;

  get diagnostics deleted_count = row_count;

  -- Also clean up orphaned chat messages (messages for deleted orders)
  delete from chat_messages
  where order_id not in (select id from orders);

  -- Log the cleanup (optional — check in Supabase logs)
  raise notice 'Pagen Maintenance: Cleaned up % old orders', deleted_count;
end;
$$;

-- 3. Set up pg_cron to run every 6 hours
-- NOTE: pg_cron must be enabled in your Supabase project first
-- Go to: Database → Extensions → Search "pg_cron" → Enable it

-- Then run this:
select cron.schedule(
  'pagen-maintenance',          -- job name
  '0 */6 * * *',               -- every 6 hours
  'select cleanup_old_orders()' -- the function to call
);

-- To check scheduled jobs:
-- select * from cron.job;

-- To manually trigger cleanup (for testing):
-- select cleanup_old_orders();

-- To unschedule:
-- select cron.unschedule('pagen-maintenance');
