-- Run this section in each tenant database.

CREATE TABLE IF NOT EXISTS crm_provider_options (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_provider_options_sort
  ON crm_provider_options(sort_order, name);

CREATE TABLE IF NOT EXISTS crm_automation_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  processing_auto_activate_enabled INTEGER NOT NULL DEFAULT 0 CHECK (processing_auto_activate_enabled IN (0, 1)),
  processing_auto_activate_delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (processing_auto_activate_delay_minutes >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO crm_automation_settings (
  id,
  processing_auto_activate_enabled,
  processing_auto_activate_delay_minutes,
  created_at,
  updated_at
) VALUES (1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE tramites ADD COLUMN processing_date TEXT;

CREATE INDEX IF NOT EXISTS idx_tramites_status_processing_date
  ON tramites(status, processing_date);

-- Run this section in the central control database used by NEXT_TURSO_CONTROL_DB_URL.

CREATE TABLE IF NOT EXISTS crm_processing_jobs (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  tenant_host TEXT NOT NULL,
  tramite_id TEXT NOT NULL,
  processing_date TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'canceled', 'skipped', 'failed')
  ),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_slug, tramite_id, processing_date)
);

CREATE INDEX IF NOT EXISTS idx_crm_processing_jobs_status_due
  ON crm_processing_jobs(status, due_at);

CREATE INDEX IF NOT EXISTS idx_crm_processing_jobs_tenant_tramite
  ON crm_processing_jobs(tenant_slug, tramite_id);
