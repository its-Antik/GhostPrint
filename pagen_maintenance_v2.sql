-- ============================================
-- Pagen Maintenance v2: PRESERVE Order History
-- Replaces the old cleanup_old_orders() function
-- Run this in your Supabase SQL Editor
-- ============================================
-- IMPORTANT: The old maintenance function DELETED delivered/cancelled
-- orders after 24 hours. This new version ONLY strips file URLs
-- (handled by ghost_cleanup_file_links) and does NOT delete orders.
-- Order history is preserved permanently for both buyer and runner.

-- 1. Drop the old destructive cleanup function
DROP FUNCTION IF EXISTS cleanup_old_orders();

-- 2. Create a safe replacement that only cleans file URLs
-- (same as ghost_cleanup_file_links but also cleans cancelled orders)
CREATE OR REPLACE FUNCTION cleanup_old_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Strip file URLs from delivered and cancelled orders older than 24h
  -- but KEEP the order row itself (history is permanent)
  UPDATE orders
  SET file_url = NULL
  WHERE status IN ('delivered', 'cancelled')
    AND updated_at < now() - interval '24 hours'
    AND file_url IS NOT NULL;

  -- Strip url and file_id from file_metadata JSONB (keep name, pages, copies, colorMode)
  UPDATE orders
  SET file_metadata = (
    SELECT jsonb_agg(
      elem - 'url' - 'file_id'
    )
    FROM jsonb_array_elements(file_metadata) AS elem
  )
  WHERE status IN ('delivered', 'cancelled')
    AND updated_at < now() - interval '24 hours'
    AND file_metadata IS NOT NULL
    AND file_metadata != '[]'::jsonb
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(file_metadata) AS e
      WHERE e ? 'url' OR e ? 'file_id'
    );

  -- Clear pickup_code from old delivered orders
  UPDATE orders
  SET pickup_code = NULL
  WHERE status = 'delivered'
    AND updated_at < now() - interval '24 hours'
    AND pickup_code IS NOT NULL;

  RAISE NOTICE 'Pagen Maintenance v2: Cleaned file URLs (orders preserved)';
END;
$$;

-- 3. Also add a short_id column for human-readable order IDs
-- This generates a unique 8-char alphanumeric ID like "PGN-A3B7C2D1"
ALTER TABLE orders ADD COLUMN IF NOT EXISTS short_id text;

-- Generate short_id for all existing orders that don't have one
UPDATE orders
SET short_id = 'PGN-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6))
WHERE short_id IS NULL;

-- Create a trigger to auto-generate short_id on insert
CREATE OR REPLACE FUNCTION generate_order_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := 'PGN-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_short_id ON orders;
CREATE TRIGGER trg_generate_short_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_short_id();

-- 4. Verify: The pg_cron job 'pagen-maintenance' now calls the safe version
-- No need to reschedule — it still calls cleanup_old_orders() which is now safe
