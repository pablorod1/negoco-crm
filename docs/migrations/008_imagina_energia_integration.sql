-- Imagina Energia tenant integration.
-- SQLite/libSQL does not support portable ADD COLUMN IF NOT EXISTS.
-- Before re-running ALTER TABLE statements, check PRAGMA table_info for each table.

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE comercializadora_rates ADD COLUMN provider TEXT;
ALTER TABLE comercializadora_rates ADD COLUMN external_rate_id TEXT;
ALTER TABLE comercializadora_rates ADD COLUMN alias_externo TEXT;
ALTER TABLE comercializadora_rates ADD COLUMN codigo_atr TEXT;
ALTER TABLE comercializadora_rates ADD COLUMN descripcion TEXT;
ALTER TABLE comercializadora_rates ADD COLUMN raw TEXT;
ALTER TABLE comercializadora_rates ADD COLUMN synced_at TEXT;
ALTER TABLE comercializadora_rates ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comercializadora_rates_provider_external
ON comercializadora_rates(comercializadora_id, provider, external_rate_id);

CREATE INDEX IF NOT EXISTS idx_comercializadora_rates_provider_enabled
ON comercializadora_rates(provider, enabled, comercializadora_id);

ALTER TABLE contracts ADD COLUMN rate_id TEXT;
ALTER TABLE contracts ADD COLUMN tipo_via_cnmc TEXT;
ALTER TABLE contracts ADD COLUMN calle TEXT;
ALTER TABLE contracts ADD COLUMN numero_finca TEXT;
ALTER TABLE contracts ADD COLUMN aclarador_finca TEXT;
ALTER TABLE contracts ADD COLUMN tipo_autoconsumo_cnmc TEXT;
ALTER TABLE contracts ADD COLUMN signature_channel TEXT NOT NULL DEFAULT 'email';
ALTER TABLE contracts ADD COLUMN es_alta_nueva INTEGER;
ALTER TABLE contracts ADD COLUMN mismo_titular INTEGER;
ALTER TABLE contracts ADD COLUMN misma_potencia INTEGER;
ALTER TABLE contracts ADD COLUMN imagina_contract_id TEXT;
ALTER TABLE contracts ADD COLUMN imagina_contract_code TEXT;
ALTER TABLE contracts ADD COLUMN imagina_request_id TEXT;
ALTER TABLE contracts ADD COLUMN imagina_status TEXT;
ALTER TABLE contracts ADD COLUMN imagina_substatus TEXT;
ALTER TABLE contracts ADD COLUMN imagina_synced_at TEXT;

CREATE INDEX IF NOT EXISTS idx_contracts_rate_id ON contracts(rate_id);
CREATE INDEX IF NOT EXISTS idx_contracts_imagina_contract_id ON contracts(imagina_contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_imagina_request_id ON contracts(imagina_request_id);

ALTER TABLE clients ADD COLUMN tipo_via_cnmc TEXT;
ALTER TABLE clients ADD COLUMN calle TEXT;
ALTER TABLE clients ADD COLUMN numero_finca TEXT;
ALTER TABLE clients ADD COLUMN aclarador_finca TEXT;
ALTER TABLE clients ADD COLUMN phone_prefix TEXT NOT NULL DEFAULT '34';
ALTER TABLE clients ADD COLUMN cnae TEXT;

ALTER TABLE signers ADD COLUMN document_type TEXT;
ALTER TABLE signers ADD COLUMN phone_prefix TEXT NOT NULL DEFAULT '34';

CREATE TABLE IF NOT EXISTS imagina_contract_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  tramite_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  referencia_externa TEXT NOT NULL UNIQUE,
  request_id TEXT,
  endpoint TEXT NOT NULL,
  payload TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  validation_errors TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_imagina_submissions_tramite
ON imagina_contract_submissions(tramite_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imagina_submissions_request
ON imagina_contract_submissions(request_id);

CREATE TABLE IF NOT EXISTS imagina_webhook_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  request_id TEXT,
  notification_id TEXT,
  referencia_externa TEXT,
  imagina_contract_id TEXT,
  payload TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted',
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_imagina_webhook_event_request
ON imagina_webhook_events(event_type, request_id)
WHERE request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_imagina_webhook_event_notification
ON imagina_webhook_events(event_type, notification_id)
WHERE notification_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS imagina_scoring_requests (
  id TEXT PRIMARY KEY NOT NULL,
  tramite_id TEXT,
  contract_id TEXT,
  endpoint TEXT NOT NULL,
  product TEXT NOT NULL,
  mode TEXT NOT NULL,
  referencia_externa TEXT NOT NULL UNIQUE,
  request_id TEXT,
  payload TEXT NOT NULL,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE SET NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imagina_scoring_request_id
ON imagina_scoring_requests(request_id);

CREATE TABLE IF NOT EXISTS imagina_signature_requests (
  id TEXT PRIMARY KEY NOT NULL,
  tramite_id TEXT,
  contract_id TEXT,
  imagina_contract_id TEXT NOT NULL,
  request_id TEXT,
  circuito_id TEXT,
  operation TEXT NOT NULL,
  canal_envio TEXT,
  referencia_externa TEXT,
  payload TEXT NOT NULL,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE SET NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imagina_signature_circuito
ON imagina_signature_requests(circuito_id);

CREATE TABLE IF NOT EXISTS imagina_document_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  tramite_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  tramite_file_id TEXT,
  imagina_contract_id TEXT NOT NULL,
  tipo_fichero TEXT NOT NULL,
  file_hash TEXT,
  request_id TEXT,
  payload TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  FOREIGN KEY (tramite_file_id) REFERENCES tramite_files(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_imagina_documents_dedupe
ON imagina_document_uploads(imagina_contract_id, tipo_fichero, file_hash)
WHERE file_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS imagina_contract_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  contract_id TEXT,
  tramite_id TEXT,
  imagina_contract_id TEXT NOT NULL,
  imagina_contract_code TEXT,
  external_reference TEXT,
  estado_id INTEGER,
  estado_descripcion TEXT,
  subestado_id INTEGER,
  subestado_descripcion TEXT,
  raw TEXT NOT NULL,
  source TEXT NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imagina_snapshots_contract
ON imagina_contract_snapshots(imagina_contract_id, created_at DESC);
