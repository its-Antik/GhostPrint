-- Add dues and bonus columns to profiles table
-- Run this in Supabase SQL Editor

-- Add dues column (tracks accumulated platform commission)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dues numeric DEFAULT 0;

-- Add bonus column (starts at 25 for signup bonus, admin can increase)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bonus numeric DEFAULT 25;

-- Set existing users to have 25 bonus (signup credit)
UPDATE profiles SET bonus = 25 WHERE bonus IS NULL;
UPDATE profiles SET dues = 0 WHERE dues IS NULL;
