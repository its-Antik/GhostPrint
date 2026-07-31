-- Add arrived_at column to orders table
-- This tracks when the runner clicks "I Have Arrived at the Location"
-- The buyer's device listens for this via Supabase Realtime to play the arrival sound

ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN orders.arrived_at IS 'Timestamp when runner confirmed arrival at delivery location. Triggers sound+vibration on buyer device via Supabase Realtime.';
