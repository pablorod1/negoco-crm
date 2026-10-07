-- Estudios del comparador propio (fase 4). Base de cada tenant.
-- Un estudio es el análisis de una factura de una comparativa: lo extraído,
-- el suministro (SIPS o factura), las opciones y la oferta elegida. El
-- ranking no se guarda: se recalcula con los precios vigentes en price_date.

CREATE TABLE IF NOT EXISTS comparison_studies (
  id TEXT PRIMARY KEY NOT NULL,
  comparativa_id TEXT NOT NULL REFERENCES comparativas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'analyzed'
    CHECK (status IN ('analyzed', 'chosen', 'closed', 'failed')),
  invoice_file_id TEXT,
  invoice_file_name TEXT,
  cups TEXT,
  extraction TEXT,
  issues TEXT,
  supply TEXT,
  options TEXT,
  price_date TEXT NOT NULL,
  chosen_offer TEXT,
  current_total REAL,
  chosen_total REAL,
  savings REAL,
  commission REAL,
  ai_cost_usd REAL,
  error TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comparison_studies_comparativa
  ON comparison_studies (comparativa_id, created_at);
