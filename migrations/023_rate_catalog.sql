-- Base de control (NEXT_TURSO_CONTROL_DB_URL). No se aplica en las bases de tenant.

-- Catálogo único de tarifas comerciales. Una fila por producto de una
-- comercializadora (por ejemplo, Quimera «Unicornio» o Axpo «1P Plus SSCC
-- Libres»). Los precios no viven aquí: son de cada tenant. Solo Negoco da de
-- alta o retira tarifas.
CREATE TABLE IF NOT EXISTS rate_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  -- Id de la comercializadora en el maestro del backoffice, si existe.
  backoffice_supplier_id TEXT,
  -- Nombre normalizado de la comercializadora (sin acentos ni signos, en
  -- minúsculas). Es lo que casa con `comercializadoras.name` de cada tenant,
  -- porque los COM-xxx no coinciden entre tenants.
  supplier_key TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  -- Nombre del producto normalizado igual que supplier_key.
  product_key TEXT NOT NULL,
  energy TEXT NOT NULL CHECK (energy IN ('electricity', 'gas')),
  pricing TEXT NOT NULL CHECK (pricing IN ('fixed', 'indexed', 'flat', 'other')),
  -- Tarifas de acceso que ofrece el producto, separadas por comas
  -- (por ejemplo '2.0TD,3.0TD,6.1TD').
  access_tariffs TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (supplier_key, product_key)
);

CREATE INDEX IF NOT EXISTS idx_rate_catalog_supplier
  ON rate_catalog(supplier_key, status);

-- Otros nombres con los que aparece un producto en los anexos ('+Helsinki I'
-- y 'Helsinki I', '2.0TD_2 Plan Estable' y 'Plan Estable'…). La ingesta casa
-- primero por product_key y después por alias.
CREATE TABLE IF NOT EXISTS rate_catalog_aliases (
  supplier_key TEXT NOT NULL,
  alias_key TEXT NOT NULL,
  catalog_rate_id TEXT NOT NULL REFERENCES rate_catalog(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (supplier_key, alias_key)
);
