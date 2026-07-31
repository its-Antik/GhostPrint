-- Add last_seen_at column for real-time presence tracking
-- This is updated every ~15 seconds when a user is on the dashboard
-- The runners-online API counts users seen within the last 2 minutes

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

-- Index for fast presence queries (filtered by domain + recency)
CREATE INDEX IF NOT EXISTS idx_profiles_presence 
ON profiles (college_domain, last_seen_at DESC) 
WHERE last_seen_at IS NOT NULL;
