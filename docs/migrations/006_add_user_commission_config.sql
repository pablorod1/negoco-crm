-- Per-user commission percentage and predefined notes
ALTER TABLE user ADD COLUMN commission_pct REAL;
ALTER TABLE user ADD COLUMN default_notes TEXT;
