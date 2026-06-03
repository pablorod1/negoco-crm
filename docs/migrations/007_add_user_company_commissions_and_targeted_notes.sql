CREATE TABLE IF NOT EXISTS user_company_commissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  comercializadora_id TEXT NOT NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percent', 'fixed')),
  commission_value REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, comercializadora_id),
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (comercializadora_id) REFERENCES comercializadoras(id)
);

CREATE TABLE IF NOT EXISTS user_default_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('global', 'tramites', 'comparativas')),
  note TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id)
);
