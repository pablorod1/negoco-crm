-- Bases de tenant. Precios por versión, ingestas de anexos y reglas de comisión
-- del comparador propio. Idempotente: solo crea tablas e índices.
-- Las columnas nuevas de comercializadora_rates van en
-- 024_rate_versions_columns.sql (ver el .md).

-- Una versión agrupa los precios de una comercializadora que entran en vigor
-- juntos. Solo puede haber una activa por comercializadora.
CREATE TABLE IF NOT EXISTS comercializadora_rate_versions (
  id TEXT PRIMARY KEY NOT NULL,
  comercializadora_id TEXT NOT NULL REFERENCES comercializadoras(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'superseded', 'discarded')),
  -- Fechas de vigencia (YYYY-MM-DD). valid_to se rellena al activar la siguiente.
  valid_from TEXT,
  valid_to TEXT,
  source TEXT NOT NULL CHECK (source IN ('document', 'api', 'manual', 'copy')),
  ingest_id TEXT REFERENCES rate_ingests(id),
  -- Versión sobre la que se aplica una actualización parcial (un anexo que solo
  -- cambia la energía de algunas tarifas). Las filas no tocadas se copian.
  based_on_version_id TEXT REFERENCES comercializadora_rate_versions(id),
  notes TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_versions_one_active
  ON comercializadora_rate_versions(comercializadora_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_rate_versions_supplier_status
  ON comercializadora_rate_versions(comercializadora_id, status, valid_from);

-- Una fila de precios por tarifa y combinación de condiciones: nivel,
-- territorio, banda de potencia o de consumo, canal, mes de inicio, duración.
-- Los precios se guardan ya en las unidades del motor (€/kW·día y €/kWh); el
-- valor tal como venía en el anexo queda en source_values.
CREATE TABLE IF NOT EXISTS comercializadora_rate_prices (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL
    REFERENCES comercializadora_rate_versions(id) ON DELETE CASCADE,
  rate_id TEXT NOT NULL REFERENCES comercializadora_rates(id),
  access_tariff TEXT NOT NULL,
  pricing TEXT NOT NULL CHECK (pricing IN ('fixed', 'indexed', 'flat', 'other')),

  -- Condiciones. NULL significa «sin restricción».
  level TEXT,
  territory TEXT NOT NULL DEFAULT 'peninsula'
    CHECK (territory IN ('peninsula', 'baleares', 'canarias', 'ceuta_melilla')),
  channel TEXT CHECK (channel IN ('acquisition', 'renewal')),
  client_segment TEXT,
  min_power_kw REAL,
  max_power_kw REAL,
  min_annual_kwh REAL,
  max_annual_kwh REAL,
  supply_start_from TEXT,
  supply_start_to TEXT,
  term_months INTEGER,
  -- Condiciones que no caben en columnas, en JSON.
  conditions TEXT,

  -- Potencia: un precio propio, la regulada («BOE») o la regulada más un
  -- margen. Con 'regulated' y 'regulated_plus' el motor toma los peajes y
  -- cargos vigentes en la fecha del estudio.
  power_mode TEXT NOT NULL DEFAULT 'fixed'
    CHECK (power_mode IN ('fixed', 'regulated', 'regulated_plus')),
  power_margin_per_kw_year REAL,
  power_p1 REAL,
  power_p2 REAL,
  power_p3 REAL,
  power_p4 REAL,
  power_p5 REAL,
  power_p6 REAL,

  -- Energía. Un producto de precio único lleva el mismo valor en todos los
  -- periodos; nunca 0.
  energy_p1 REAL,
  energy_p2 REAL,
  energy_p3 REAL,
  energy_p4 REAL,
  energy_p5 REAL,
  energy_p6 REAL,
  -- 0 si los servicios de ajuste se facturan aparte (Quimera «sin SS.AA.»).
  includes_ancillary_services INTEGER NOT NULL DEFAULT 1
    CHECK (includes_ancillary_services IN (0, 1)),

  -- Fee que añade la agencia sobre el precio base, si la tarifa lo admite.
  fee_energy_min_per_mwh REAL,
  fee_energy_max_per_mwh REAL,
  fee_power_allowed INTEGER NOT NULL DEFAULT 0 CHECK (fee_power_allowed IN (0, 1)),

  -- Descuentos y servicios en JSON: [{ "kind": "energy_percent", "value": 15,
  -- "months": 12, "conditional": false, "text": "15% s/Te" }, …].
  discounts TEXT,
  services TEXT,

  -- Procedencia: fragmento del anexo, página u hoja, y valores originales.
  source_excerpt TEXT,
  source_location TEXT,
  source_values TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (energy_p1 IS NULL OR energy_p1 > 0),
  CHECK (energy_p2 IS NULL OR energy_p2 > 0),
  CHECK (energy_p3 IS NULL OR energy_p3 > 0)
);

CREATE INDEX IF NOT EXISTS idx_rate_prices_version
  ON comercializadora_rate_prices(version_id, rate_id);

CREATE INDEX IF NOT EXISTS idx_rate_prices_rate_tariff
  ON comercializadora_rate_prices(rate_id, access_tariff);

-- Cada documento recibido (subida manual, correo o API) y lo que se hizo con él.
CREATE TABLE IF NOT EXISTS rate_ingests (
  id TEXT PRIMARY KEY NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('upload', 'email', 'api')),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'needs_review', 'ready',
                      'approved', 'rejected', 'failed', 'out_of_scope')),
  -- Se rellena al clasificar si el que sube no la indica.
  comercializadora_id TEXT REFERENCES comercializadoras(id),
  -- Ficheros en Storage: [{ "path": "...", "name": "...", "mime": "...", "size": 0 }].
  files TEXT NOT NULL DEFAULT '[]',
  -- Texto pegado o cuerpo del correo.
  body_text TEXT,
  email_from TEXT,
  email_subject TEXT,
  -- Resultados de cada paso, en JSON.
  classification TEXT,
  extraction TEXT,
  validation TEXT,
  version_id TEXT,
  models TEXT,
  cost_usd REAL,
  error TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  -- Para la métrica de tiempo hasta aprobar (objetivo: menos de 24 horas).
  decided_at TEXT,
  created_by TEXT,
  decided_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_rate_ingests_status
  ON rate_ingests(status, received_at);

CREATE INDEX IF NOT EXISTS idx_rate_ingests_supplier
  ON rate_ingests(comercializadora_id, received_at);

-- Comisión de la agencia por tarifa, con vigencia. Una regla sin rate_id vale
-- para todas las tarifas de la comercializadora.
CREATE TABLE IF NOT EXISTS rate_commission_rules (
  id TEXT PRIMARY KEY NOT NULL,
  comercializadora_id TEXT NOT NULL REFERENCES comercializadoras(id),
  rate_id TEXT REFERENCES comercializadora_rates(id),
  access_tariff TEXT,
  level TEXT,
  channel TEXT CHECK (channel IN ('acquisition', 'renewal')),
  min_annual_kwh REAL,
  max_annual_kwh REAL,
  -- fixed: € por contrato. per_mwh: € por MWh de consumo anual.
  -- fee_share: porcentaje del fee de energía por el consumo anual.
  rule_type TEXT NOT NULL CHECK (rule_type IN ('fixed', 'per_mwh', 'fee_share')),
  amount REAL NOT NULL CHECK (amount >= 0),
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  -- Clawback, permanencia y otras condiciones, en JSON.
  conditions TEXT,
  ingest_id TEXT REFERENCES rate_ingests(id),
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_commission_rules_lookup
  ON rate_commission_rules(comercializadora_id, rate_id, valid_from);
