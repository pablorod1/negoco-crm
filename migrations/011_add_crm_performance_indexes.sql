-- Índices para mantener ágiles las colecciones interactivas del CRM a medida
-- que crece cada tenant. La migración es idempotente y no elimina índices.

-- Orden estable de la tabla de trámites y paginación por fecha.
CREATE INDEX IF NOT EXISTS idx_tramites_creation_id
  ON tramites(creation_date DESC, id DESC);

-- Acceso de comerciales/subcomerciales a sus clientes mediante EXISTS.
CREATE INDEX IF NOT EXISTS idx_tramites_client_user
  ON tramites(client_id, user_id);

-- Listados de trámites restringidos por propietario y ordenados por fecha.
CREATE INDEX IF NOT EXISTS idx_tramites_user_creation_id
  ON tramites(user_id, creation_date DESC, id DESC);

-- Orden alfabético estable del selector paginado de clientes.
CREATE INDEX IF NOT EXISTS idx_clients_name_last_name_id
  ON clients(name COLLATE NOCASE, last_name COLLATE NOCASE, id);

-- Orden estable de comparativas para administradores y comerciales.
CREATE INDEX IF NOT EXISTS idx_comparativas_creation_id
  ON comparativas(creation_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_comparativas_user_creation_id
  ON comparativas(user_id, creation_date DESC, id DESC);

-- Lectura de archivos de una comparativa sin escanear toda la tabla.
CREATE INDEX IF NOT EXISTS idx_comparativa_files_comparativa_upload
  ON comparativa_files(comparativa_id, upload_date DESC);

-- Resolución de sesiones activas/recientes por usuario.
CREATE INDEX IF NOT EXISTS idx_session_user_created_at
  ON session(user_id, created_at DESC);
