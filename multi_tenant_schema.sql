-- ============================================
-- Pagen Multi-Tenant Schema Update
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add college_domain to profiles (auto-extracted from email)
alter table public.profiles add column if not exists college_domain text;

-- 2. Add college_domain to orders (tags every order to a campus)
alter table public.orders add column if not exists college_domain text;

-- 3. Backfill existing Heritage profiles
update public.profiles
set college_domain = 'heritageit.edu.in'
where college_domain is null
  and username like '%@heritageit.edu.in';

-- 4. Backfill existing orders from Heritage users
update public.orders
set college_domain = 'heritageit.edu.in'
where college_domain is null;

-- 5. Create an index for fast domain-filtered queries
create index if not exists idx_orders_college_domain on public.orders (college_domain);
create index if not exists idx_profiles_college_domain on public.profiles (college_domain);

-- 6. (Optional) Create a colleges registry for future admin management
create table if not exists colleges (
  id uuid default gen_random_uuid() primary key,
  name text not null,                    -- e.g., "Heritage Institute of Technology"
  email_domain text unique not null,     -- e.g., "heritageit.edu.in"
  is_active boolean default true,        -- flip this to enable/disable a campus
  created_at timestamp with time zone default now()
);

-- Seed Heritage as the first active college
insert into colleges (name, email_domain, is_active)
values ('Heritage Institute of Technology', 'heritageit.edu.in', true)
on conflict (email_domain) do nothing;

-- Allow public reads on colleges table (for auth validation)
alter table colleges enable row level security;
create policy "Anyone can view active colleges" on colleges
  for select using (true);
grant select on colleges to anon;
grant select on colleges to authenticated;
grant all on colleges to service_role;
