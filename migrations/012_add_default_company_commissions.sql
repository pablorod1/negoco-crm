-- Comisiones por defecto de la asesoría por comercializadora.
-- Cada colaborador hereda estos valores salvo que tenga una fila propia en
-- user_company_commissions (override). Así un cambio de porcentaje "para todos"
-- se hace una sola vez en lugar de colaborador a colaborador.
-- La migración es idempotente.

CREATE TABLE IF NOT EXISTS default_company_commissions (
  id TEXT PRIMARY KEY,
  comercializadora_id TEXT NOT NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percent', 'fixed')),
  commission_value REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comercializadora_id),
  FOREIGN KEY (comercializadora_id) REFERENCES comercializadoras(id)
);

CREATE INDEX IF NOT EXISTS idx_user_company_commissions_user
  ON user_company_commissions(user_id);

-- Hasta ahora el modal de configuración guardaba una fila por CADA
-- comercializadora activa, incluidas las que el admin nunca tocó (valor 0).
-- Esas filas son overrides fantasma: bloquearían la herencia del valor por
-- defecto para todo el mundo. Un override a 0 no aporta importe alguno, así que
-- se eliminan para que esos colaboradores pasen a heredar.
DELETE FROM user_company_commissions WHERE commission_value = 0;
