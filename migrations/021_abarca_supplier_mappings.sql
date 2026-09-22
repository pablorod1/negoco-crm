-- Equivalencias mantenidas desde Negoco Backoffice, sin sincronizar comisiones.
CREATE TABLE IF NOT EXISTS abarca_supplier_mappings (
  abarca_user_id INTEGER NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('gas','luz_20td','luz_pymes')),
  name_key TEXT NOT NULL,
  abarca_name TEXT NOT NULL,
  comercializadora_id TEXT REFERENCES comercializadoras(id),
  source TEXT NOT NULL CHECK (source IN ('automatic','manual')),
  available INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (abarca_user_id, segment, name_key)
);
