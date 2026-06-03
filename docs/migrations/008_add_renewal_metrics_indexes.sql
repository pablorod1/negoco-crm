CREATE INDEX IF NOT EXISTS idx_contracts_type_tramite
  ON contracts(type, tramite_id);

CREATE INDEX IF NOT EXISTS idx_tramites_status_renovation_user
  ON tramites(status, renovation_date, user_id);
