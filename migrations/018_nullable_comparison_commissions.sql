-- Turso/libSQL only. See the accompanying .md for preflight and execution.
-- Preserve ALL existing values, including zeros in pending/processing comparisons.
-- Run the entire file on one session; stop and ROLLBACK on any error.
BEGIN IMMEDIATE;

ALTER TABLE comparativas ALTER COLUMN comision_fijo TO comision_fijo REAL;
ALTER TABLE comparativas ALTER COLUMN comision_indexado TO comision_indexado REAL;
ALTER TABLE comparativas ALTER COLUMN comision_sales_person_fijo TO comision_sales_person_fijo REAL;
ALTER TABLE comparativas ALTER COLUMN comision_sales_person_indexado TO comision_sales_person_indexado REAL;

COMMIT;
