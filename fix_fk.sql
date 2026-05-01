-- GhostPrint: Fix profiles table for NextAuth compatibility
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run
--
-- Problem: profiles.id has a foreign key to auth.users, but we use 
-- NextAuth (Google OAuth), not Supabase Auth. So there's no matching 
-- auth.users row, and inserts fail.

-- Step 1: Drop the foreign key constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Set a default UUID generator so id auto-fills on insert
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 3: Also add runner_name column to orders if it doesn't exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS runner_name TEXT;

-- Done! Close this tab and go back to the app. Profiles will now save correctly.
