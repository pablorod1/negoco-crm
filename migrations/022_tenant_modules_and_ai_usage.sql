-- Base de control (NEXT_TURSO_CONTROL_DB_URL). No se aplica en las bases de tenant.

-- Módulos contratados por cada tenant. Solo los cambia Negoco.
CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_slug TEXT NOT NULL,
  module_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  plan TEXT,
  notes TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_slug, module_key)
);

-- Una fila por llamada a la IA, para medir coste por tenant y tipo de trabajo.
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_slug TEXT NOT NULL,
  job_type TEXT NOT NULL,
  model TEXT NOT NULL,
  subject_id TEXT,
  user_id TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd REAL,
  generation_id TEXT,
  succeeded INTEGER NOT NULL CHECK (succeeded IN (0, 1)),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_tenant_created
  ON ai_usage_events(tenant_slug, created_at);

-- Piloto: solo el tenant de test.
INSERT OR IGNORE INTO tenant_modules
  (tenant_slug, module_key, enabled, notes, updated_by)
VALUES
  ('test', 'negoco_studies', 1, 'Piloto del comparador propio', 'migration-022');
