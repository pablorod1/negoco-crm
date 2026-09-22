-- Comisiones por segmento y outbox duradero para Abarca.
-- IMPORTANTE: ejecutar con los escritores pausados. La migración replica cada
-- regla antigua en los tres segmentos para conservar exactamente su alcance.

PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

ALTER TABLE user_company_commissions RENAME TO user_company_commissions_legacy;

CREATE TABLE user_company_commissions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id),
  comercializadora_id TEXT NOT NULL REFERENCES comercializadoras(id),
  segment TEXT NOT NULL CHECK (segment IN ('luz_20td', 'luz_pymes', 'gas')),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percent', 'fixed')),
  commission_value REAL NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, comercializadora_id, segment)
);

INSERT INTO user_company_commissions
  (id, user_id, comercializadora_id, segment, commission_type, commission_value, created_at, updated_at)
SELECT id || ':' || segment, user_id, comercializadora_id, segment,
       commission_type, commission_value, created_at, updated_at
FROM user_company_commissions_legacy
CROSS JOIN (
  SELECT 'luz_20td' AS segment
  UNION ALL SELECT 'luz_pymes'
  UNION ALL SELECT 'gas'
);

DROP TABLE user_company_commissions_legacy;
CREATE INDEX idx_user_company_commissions_user
  ON user_company_commissions(user_id);

ALTER TABLE default_company_commissions RENAME TO default_company_commissions_legacy;

CREATE TABLE default_company_commissions (
  id TEXT PRIMARY KEY NOT NULL,
  comercializadora_id TEXT NOT NULL REFERENCES comercializadoras(id),
  segment TEXT NOT NULL CHECK (segment IN ('luz_20td', 'luz_pymes', 'gas')),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percent', 'fixed')),
  commission_value REAL NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comercializadora_id, segment)
);

INSERT INTO default_company_commissions
  (id, comercializadora_id, segment, commission_type, commission_value, created_at, updated_at)
SELECT id || ':' || segment, comercializadora_id, segment,
       commission_type, commission_value, created_at, updated_at
FROM default_company_commissions_legacy
CROSS JOIN (
  SELECT 'luz_20td' AS segment
  UNION ALL SELECT 'luz_pymes'
  UNION ALL SELECT 'gas'
);

DROP TABLE default_company_commissions_legacy;

CREATE TABLE abarca_commission_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  comercializadora_id TEXT NOT NULL REFERENCES comercializadoras(id),
  segment TEXT NOT NULL CHECK (segment IN ('luz_20td', 'luz_pymes', 'gas')),
  abarca_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comercializadora_id, segment, abarca_name),
  UNIQUE (segment, abarca_name)
);

CREATE TABLE abarca_commission_sync_state (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  abarca_user_id INTEGER,
  desired_revision INTEGER NOT NULL DEFAULT 0,
  confirmed_revision INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (status IN ('not_applicable', 'pending', 'syncing', 'synced', 'attention')),
  payload_hash TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  lock_token TEXT,
  locked_at TEXT,
  last_error TEXT,
  last_warnings TEXT,
  last_confirmed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inventario de combinaciones remotas que alguna vez gestionó el CRM. Se
-- conserva aunque desaparezca la regla o cambie el mapeo para poder retirarla.
CREATE TABLE abarca_commission_managed_rules (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  abarca_user_id INTEGER NOT NULL,
  abarca_name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('luz_20td', 'luz_pymes', 'gas')),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percent', 'fixed')),
  desired_value REAL NOT NULL CHECK (desired_value >= 0),
  desired_revision INTEGER NOT NULL,
  confirmed_revision INTEGER,
  retiring INTEGER NOT NULL DEFAULT 0 CHECK (retiring IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, abarca_user_id, abarca_name, segment)
);

CREATE TABLE abarca_commission_audit (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  revision INTEGER,
  event TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_abarca_commission_sync_due
  ON abarca_commission_sync_state(status, next_attempt_at);
CREATE INDEX idx_abarca_commission_managed_user
  ON abarca_commission_managed_rules(user_id, desired_revision);

ALTER TABLE comparativas ADD COLUMN commission_segment TEXT
  CHECK (commission_segment IN ('luz_20td', 'luz_pymes', 'gas'));
ALTER TABLE comparativas ADD COLUMN commission_segment_origin TEXT
  CHECK (commission_segment_origin IN ('service', 'tariff', 'user', 'abarca'));

UPDATE comparativas
SET commission_segment = 'gas', commission_segment_origin = 'service'
WHERE LOWER(TRIM(service)) = 'gas' AND commission_segment IS NULL;

COMMIT;
PRAGMA foreign_keys = ON;
