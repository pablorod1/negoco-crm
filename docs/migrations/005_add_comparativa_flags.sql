-- Add permanencia and renovacion flags to comparativas
-- These are boolean flags set by backoffice to indicate offer conditions.

-- Check current columns before running (manual verification step)
PRAGMA table_info(comparativas);
-- NOTE: This migration is NOT idempotent. Running twice will error.
-- Check the PRAGMA output above before executing the ALTER TABLE statements.

-- Add has_permanencia column if missing
ALTER TABLE comparativas ADD COLUMN has_permanencia INTEGER NOT NULL DEFAULT 0;

-- Add has_renovacion column if missing
ALTER TABLE comparativas ADD COLUMN has_renovacion INTEGER NOT NULL DEFAULT 0;
