-- Propuestas del comparador propio (fase 4). Base de cada tenant, después de
-- la 026. Idempotente.
-- Una propuesta es una oferta del estudio tal como se enseña al cliente: la
-- foto de precios, costes y ahorro con la que se genera su PDF. Se pueden
-- generar las que haga falta; al completar el estudio se elige una y su PDF
-- pasa a los documentos de la comparativa.

CREATE TABLE IF NOT EXISTS comparison_study_proposals (
  id TEXT PRIMARY KEY NOT NULL,
  study_id TEXT NOT NULL REFERENCES comparison_studies(id) ON DELETE CASCADE,
  -- 1, 2, 3… dentro del estudio, para nombrarlas («Propuesta 2»).
  number INTEGER NOT NULL,
  offer_key TEXT NOT NULL,
  comercializadora_id TEXT NOT NULL,
  comercializadora_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  fee_energy_per_mwh REAL NOT NULL DEFAULT 0,
  annual_total REAL NOT NULL,
  savings REAL,
  commission REAL,
  -- Lo que muestra el PDF (JSON). No lleva comisión ni fee.
  document TEXT NOT NULL,
  -- Al completar el estudio: la elegida y su documento en la comparativa.
  chosen_at TEXT,
  comparativa_file_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (study_id, number)
);

CREATE INDEX IF NOT EXISTS idx_comparison_study_proposals_study
  ON comparison_study_proposals (study_id, number);
