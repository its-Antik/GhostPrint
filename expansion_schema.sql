-- ============================================
-- GhostPrint Campus Expansion Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create the expansion requests table
create table if not exists expansion_requests (
  id uuid default gen_random_uuid() primary key,
  college_name text not null,
  student_email text not null,
  campus_size text,              -- '<500', '1000', '5000+'
  referrer text,                 -- referral slug (e.g., 'iem-kolkata')
  status text default 'pending', -- 'pending' or 'active'
  created_at timestamp with time zone default now(),
  
  -- Prevent duplicate submissions from same email for same college
  unique(student_email, college_name)
);

-- 2. Create leaderboard view (aggregates requests per college)
create or replace view campus_leaderboard as
select 
  college_name, 
  count(*) as request_count,
  50 as target_count  -- Universal unlock goal
from expansion_requests
group by college_name
order by request_count desc;

-- 3. Enable Row Level Security
alter table expansion_requests enable row level security;

-- 4. Allow public inserts (anyone can request expansion, no auth required)
create policy "Anyone can request expansion" on expansion_requests
  for insert with check (true);

-- 5. Allow public reads (for the leaderboard)
create policy "Anyone can view expansion requests" on expansion_requests
  for select using (true);

-- 6. Grant access to the anon and service roles
grant select, insert on expansion_requests to anon;
grant select, insert on expansion_requests to authenticated;
grant all on expansion_requests to service_role;

-- 7. Add to realtime publication (optional, for live updates)
-- alter publication supabase_realtime add table expansion_requests;
