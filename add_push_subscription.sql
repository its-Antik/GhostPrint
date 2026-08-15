-- Add the missing push_subscription column to profiles
-- Run this in your Supabase SQL Editor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;
