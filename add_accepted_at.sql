-- Run this in Supabase SQL Editor to add the accepted_at column
-- This stores when a runner accepted the order (for the 45s free-cancel window)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;
