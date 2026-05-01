-- Profiles table for both Buyers and Runners
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  alias text,                -- Ghost Alias for Runners
  department text,           -- Student's department
  phone text,                -- WhatsApp number for updates
  upi_qr_url text,           -- URL to the runner's UPI QR code in storage
  is_runner boolean default false,
  balance decimal(10, 2) default 0.00, -- Digital Ghost Wallet balance (Debt is negative)
  trust_rating decimal(3, 2) default 5.00,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS: Security
alter table profiles enable row level security;

-- Users can view and edit their own profiles
create policy "Users view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

-- Public view for some runner info (alias, department) during selection
create policy "Public view runner basic info" on profiles
  for select using (is_runner = true);

-- Add push_subscription column if needed for notifications
alter table profiles add column if not null push_subscription jsonb;
