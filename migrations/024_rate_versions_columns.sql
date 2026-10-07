-- Bases de tenant. Se ejecuta UNA vez por tenant: SQLite no admite
-- ADD COLUMN IF NOT EXISTS. Antes, comprobar con
--   PRAGMA table_info(comercializadora_rates);
-- que catalog_rate_id no existe todavía.

-- Enlace con rate_catalog de la base de control. NULL en las tarifas que no
-- vienen del catálogo (por ejemplo, las sincronizadas desde la API de Imagina).
ALTER TABLE comercializadora_rates ADD COLUMN catalog_rate_id TEXT;

CREATE INDEX IF NOT EXISTS idx_comercializadora_rates_catalog
  ON comercializadora_rates(catalog_rate_id);
