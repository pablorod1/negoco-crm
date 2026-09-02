-- No backfill: completed historical deliveries must never produce a proposal.
CREATE TABLE IF NOT EXISTS comparison_study_results (
  id TEXT PRIMARY KEY NOT NULL,
  comparativa_id TEXT NOT NULL UNIQUE REFERENCES comparativas(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  received_type TEXT CHECK(received_type IN ('fijo', 'indexado')),
  chosen_type TEXT CHECK(chosen_type IN ('fijo', 'indexado')),
  type_origin TEXT CHECK(type_origin IN ('received', 'user')),
  offer_euros REAL,
  base_percentage REAL,
  supplier_name TEXT,
  crm_id INTEGER NOT NULL,
  verified_author_id TEXT,
  receipt_owner_id TEXT NOT NULL,
  revision_salt TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending', 'applied', 'resolved')),
  resolution_actor_id TEXT,
  resolved_at TEXT,
  resolution_request TEXT,
  resolution_revision TEXT,
  applied_values TEXT,
  calculation_source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
