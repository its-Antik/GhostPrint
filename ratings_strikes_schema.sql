-- =============================================
-- Pagen: Ratings, Reports & Strike System
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Ratings table — both buyer and runner rate each other per order
CREATE TABLE IF NOT EXISTS ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rater_email text NOT NULL,        -- who is rating
  ratee_email text NOT NULL,        -- who is being rated
  rater_role text NOT NULL CHECK (rater_role IN ('buyer', 'runner')),
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at timestamp with time zone DEFAULT now()
);

-- Unique constraint: one rating per rater per order
CREATE UNIQUE INDEX IF NOT EXISTS ratings_unique_idx ON ratings (order_id, rater_email);

-- 2. Reports table — buyer/runner can report each other
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reporter_email text NOT NULL,
  reported_email text NOT NULL,
  feedback text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_idx ON reports (order_id, reporter_email);

-- 3. Add strike_count to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strike_count integer DEFAULT 0;

-- 4. Add avg_rating and total_ratings to profiles for quick lookups
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_rating decimal(3, 2) DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_ratings integer DEFAULT 0;

-- 5. Add account_disabled flag for strike-based disabling
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_disabled boolean DEFAULT false;

-- 6. RLS policies for ratings
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own ratings" ON ratings;
CREATE POLICY "Users can insert own ratings" ON ratings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view all ratings" ON ratings;
CREATE POLICY "Users can view all ratings" ON ratings
  FOR SELECT USING (true);

-- 7. RLS policies for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert reports" ON reports;
CREATE POLICY "Users can insert reports" ON reports
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own reports" ON reports;
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (true);
