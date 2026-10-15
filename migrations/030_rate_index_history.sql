-- Base de cada tenant con el módulo del comparador. Idempotente.

-- Histórico del indexado: el precio de la energía que cobró una tarifa
-- indexada cada mes, por periodo, en €/kWh (como la energía de las tarifas
-- fijas). Con él se calcula lo que habría pagado el cliente con esa tarifa en
-- sus 12 meses de consumo del SIPS. Un mes por fila; volver a cargar un mes lo
-- sustituye.
CREATE TABLE IF NOT EXISTS comercializadora_index_history (
  id TEXT PRIMARY KEY NOT NULL,
  comercializadora_id TEXT NOT NULL REFERENCES comercializadoras(id),
  -- Tarifa del tenant; NULL = todas las indexadas de la comercializadora que
  -- no tengan histórico propio.
  rate_id TEXT REFERENCES comercializadora_rates(id),
  access_tariff TEXT NOT NULL DEFAULT '2.0TD',
  -- YYYY-MM.
  month TEXT NOT NULL,
  energy_p1 REAL NOT NULL CHECK (energy_p1 > 0),
  energy_p2 REAL NOT NULL CHECK (energy_p2 > 0),
  energy_p3 REAL NOT NULL CHECK (energy_p3 > 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'document')),
  ingest_id TEXT REFERENCES rate_ingests(id),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_index_history_month
  ON comercializadora_index_history(comercializadora_id, COALESCE(rate_id, ''), access_tariff, month);
