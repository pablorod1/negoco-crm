-- Base de cada tenant con el módulo del comparador. Idempotente.

-- Ajustes del comparador del tenant, como clave y valor (JSON). El primero:
-- los servicios de ajuste (SSAA) por defecto para simular las tarifas que los
-- cobran aparte («ancillary_default»).
CREATE TABLE IF NOT EXISTS comparador_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
