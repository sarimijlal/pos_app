-- Add optional second IMEI to support dual-SIM phones (two physical IMEI numbers per device).
-- SQLite does not allow ADD COLUMN with a UNIQUE constraint, so we add the column first
-- then create a partial unique index that only enforces uniqueness for non-NULL values.
ALTER TABLE imei_units ADD COLUMN imei2 TEXT;
CREATE UNIQUE INDEX idx_imei_units_imei2 ON imei_units(imei2) WHERE imei2 IS NOT NULL;
