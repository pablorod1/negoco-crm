-- Base de control (NEXT_TURSO_CONTROL_DB_URL). No se aplica en las bases de tenant.

-- Lecturas de anexos por huella del fichero (sha256). Las comercializadoras
-- mandan el mismo anexo a todas las agencias: el primer tenant que lo recibe
-- paga la lectura y los demás la reutilizan sin llamar a la IA. Solo se
-- comparte la lectura (precios y comisiones leídos); la aprobación sigue
-- siendo de cada tenant.
CREATE TABLE IF NOT EXISTS rate_document_readings (
  sha256 TEXT PRIMARY KEY NOT NULL,
  file_name TEXT NOT NULL,
  -- La comercializadora que dice el documento, para consultar.
  supplier_name TEXT,
  -- RateExtractionResult en JSON, como rate_ingests.extraction.
  result TEXT NOT NULL,
  cost_usd REAL,
  -- El tenant que pagó la lectura.
  tenant_slug TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);
