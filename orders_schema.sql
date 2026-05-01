-- Create an ENUM for order status
create type order_status as enum ('searching', 'pending', 'accepted', 'printing', 'ready', 'delivered', 'cancelled');

create table orders (
  id uuid default gen_random_uuid() primary key,
  buyer_id text not null, -- Stores user email from NextAuth
  runner_id text,         -- Stores runner email from NextAuth
  page_count int not null,
  total_price decimal(10, 2) not null,
  status order_status default 'searching',
  pickup_code text, -- The 6-digit OTP
  delivery_location text,
  file_url text, -- Kept for compatibility if they use it
  file_metadata jsonb default '[]'::jsonb,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS: Security updated for email-based IDs
alter table orders enable row level security;

-- Buyers can see their own orders based on their JWT email
create policy "Buyers view own orders" on orders 
  for select using (auth.jwt() ->> 'email' = buyer_id);

-- Runners can see orders they have claimed
create policy "Runners view claimed orders" on orders 
  for select using (auth.jwt() ->> 'email' = runner_id);

-- All verified students can see 'searching' or 'pending' orders to claim them
create policy "View available gigs" on orders 
  for select using (status in ('searching', 'pending'));
