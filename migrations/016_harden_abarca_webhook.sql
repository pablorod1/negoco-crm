CREATE TABLE IF NOT EXISTS abarca_webhook_deliveries (
  comparativa_id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  claim_token TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  claimed_at TEXT NOT NULL,
  lease_expires_at INTEGER NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_abarca_webhook_deliveries_status_lease
  ON abarca_webhook_deliveries(status, lease_expires_at);

CREATE TABLE IF NOT EXISTS abarca_webhook_cleanup_queue (
  comparativa_id TEXT NOT NULL,
  claim_token TEXT NOT NULL,
  storage_paths TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'pending')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comparativa_id, claim_token),
  FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_abarca_webhook_cleanup_queue_status
  ON abarca_webhook_cleanup_queue(status, updated_at);
