-- Add print_specs JSONB column to orders table
-- Stores buyer's print specifications: sides, finishing, additionalRequests
-- Example: {"sides": "single", "finishing": "stapled", "additionalRequests": "Print pages 1-5 only"}

ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_specs JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN orders.print_specs IS 'Print specification matrix: sides (single/double), finishing (stapled/loose), additionalRequests (freetext)';
