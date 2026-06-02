-- Add permanencia and renovacion flags to comparativas
-- These are boolean flags set by backoffice to indicate offer conditions.

-- Guard: only add columns if they don't exist (SQLite safe migration)
PRAGMA table_info(comparativas);

-- Add has_permanencia column if missing
ALTER TABLE comparativas ADD COLUMN has_permanencia INTEGER NOT NULL DEFAULT 0;

-- Add has_renovacion column if missing
ALTER TABLE comparativas ADD COLUMN has_renovacion INTEGER NOT NULL DEFAULT 0;
