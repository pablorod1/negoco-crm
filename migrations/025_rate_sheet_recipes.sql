-- Base de control (NEXT_TURSO_CONTROL_DB_URL). No se aplica en las bases de tenant.

-- Plantillas para leer los Excel de precios. La IA describe una vez cómo está
-- montado el Excel de una comercializadora (hojas, filas, columnas) y nuestro
-- código lee las celdas; mientras el formato no cambie, la plantilla se
-- reutiliza sin llamar a la IA. Son comunes a todos los tenants.
CREATE TABLE IF NOT EXISTS rate_sheet_recipes (
  id TEXT PRIMARY KEY NOT NULL,
  -- Comercializadora, normalizada como en rate_catalog.supplier_key.
  supplier_key TEXT NOT NULL,
  -- Forma del libro: nombres de hoja normalizados y ordenados.
  signature TEXT NOT NULL,
  recipe TEXT NOT NULL,
  model TEXT,
  uses INTEGER NOT NULL DEFAULT 0,
  -- Veces seguidas que no ha encajado; se pone a 0 al rehacerla.
  failures INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  UNIQUE (supplier_key, signature)
);
