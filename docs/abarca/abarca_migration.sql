ALTER TABLE organization ADD COLUMN abarca_user_id INTEGER DEFAULT NULL;

CREATE TABLE abarca_estudios (
  id TEXT PRIMARY KEY,
  comparativa_id TEXT NOT NULL UNIQUE,
  crm_id INTEGER NOT NULL,
  ide INTEGER NOT NULL,

  -- Suministro
  cups TEXT NOT NULL,
  tipo_tarifa TEXT,
  potencia_contratada REAL,
  potencia_contratada_p2 REAL,

  -- Empresas
  empresa_cliente TEXT,          -- Comercializadora actual
  empresa TEXT,                  -- Comercializadora propuesta

  -- Titular
  nombre_completo TEXT,
  titular TEXT,
  ape1 TEXT,
  ape2 TEXT,
  dni TEXT,
  nif_empresa INTEGER DEFAULT 0,
  autonomo INTEGER DEFAULT 0,

  -- Dirección titular
  calle TEXT,
  numero TEXT,
  codpostal TEXT,
  localidad TEXT,

  -- Dirección CUPS
  calle_cups TEXT,
  numero_cups TEXT,
  codpostal_cups TEXT,
  localidad_cups TEXT,

  -- Contacto
  email TEXT,
  movil TEXT,
  iban TEXT,

  -- Banderas
  cambio_titularidad INTEGER DEFAULT 0,
  tiene_placas INTEGER DEFAULT 0,

  -- Otros
  observaciones TEXT,
  servicios TEXT,
  permanencia INTEGER DEFAULT 0,

  -- Metadata completa (JSON blob con todo el payload original)
  raw_payload TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
);

CREATE INDEX idx_abarca_estudios_comparativa ON abarca_estudios(comparativa_id);
CREATE INDEX idx_abarca_estudios_crm_id ON abarca_estudios(crm_id);
CREATE INDEX idx_abarca_estudios_cups ON abarca_estudios(cups);

CREATE TABLE abarca_sessions (
  id TEXT PRIMARY KEY,
  comparativa_id TEXT NOT NULL,
  crm_id INTEGER NOT NULL,        -- idcm de Abarca (= organization.abarca_user_id)
  tenant TEXT NOT NULL,
  user_id TEXT NOT NULL,          -- ID del usuario que abrió el panel
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
);

CREATE INDEX idx_abarca_sessions_lookup ON abarca_sessions(crm_id, tenant, status);
CREATE INDEX idx_abarca_sessions_user ON abarca_sessions(user_id, status);
CREATE INDEX idx_abarca_sessions_comparativa ON abarca_sessions(comparativa_id);