-- Base de cada tenant, después de la 026. Se ejecuta UNA vez por tenant:
-- SQLite no admite ADD COLUMN IF NOT EXISTS. Antes, comprobar con
--   PRAGMA table_info(comparison_studies);
-- que client_data no existe todavía.

-- Datos del cliente que se apuntan al completar el estudio (todos
-- opcionales), en JSON. Rellenan el trámite al convertir la comparativa.
ALTER TABLE comparison_studies ADD COLUMN client_data TEXT;
