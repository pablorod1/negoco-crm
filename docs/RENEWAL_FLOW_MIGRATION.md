# Migración de Base de Datos: Flujo de Renovación Mejorado

## Scripts SQL

### Migración completa

```sql
-- =============================================
-- MIGRACIÓN: Flujo de renovación mejorado
-- Fecha: 2026-03-16
-- =============================================

-- 1. Añadir columna renewal_count a tramites
ALTER TABLE tramites ADD COLUMN renewal_count INTEGER NOT NULL DEFAULT 0;

-- 2. Crear tabla tramite_renewal_history
CREATE TABLE IF NOT EXISTS tramite_renewal_history (
    id TEXT PRIMARY KEY NOT NULL,
    tramite_id TEXT NOT NULL,
    renewal_number INTEGER NOT NULL,
    user_id TEXT,
    previous_activation_date TEXT,
    previous_renovation_date TEXT,
    new_activation_date TEXT NOT NULL,
    new_renovation_date TEXT NOT NULL,
    previous_status TEXT,
    previous_liquidez_status TEXT,
    company_changed INTEGER NOT NULL DEFAULT 0,
    previous_company TEXT,
    new_company TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_id
  ON tramite_renewal_history(tramite_id);
CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_date
  ON tramite_renewal_history(tramite_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_renewal_history_user_id
  ON tramite_renewal_history(user_id);

-- 3. Inicializar renewal_count para trámites existentes con renovaciones previas
UPDATE tramites SET renewal_count = (
  SELECT COUNT(*) FROM tramite_changes
  WHERE tramite_changes.tramite_id = tramites.id
  AND tramite_changes.change_type IN ('renewal_created', 'renewal_updated')
) WHERE id IN (
  SELECT DISTINCT tramite_id FROM tramite_changes
  WHERE change_type IN ('renewal_created', 'renewal_updated')
);
```

### Verificación post-migración

```sql
-- Verificar que la columna renewal_count existe
SELECT id, renewal_count FROM tramites LIMIT 5;

-- Verificar que la tabla tramite_renewal_history existe
SELECT name FROM sqlite_master WHERE type='table' AND name='tramite_renewal_history';

-- Verificar índices creados
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_renewal_history%';

-- Verificar trámites con renewal_count > 0 (si hay datos previos)
SELECT id, renewal_count FROM tramites WHERE renewal_count > 0;
```

### Rollback (en caso de error)

```sql
-- Revertir la migración
DROP TABLE IF EXISTS tramite_renewal_history;

-- Nota: SQLite no soporta DROP COLUMN directamente.
-- Para revertir renewal_count habría que recrear la tabla tramites.
-- En la práctica, la columna con DEFAULT 0 no causa problemas si se mantiene.
```

---

## Guía de ejecución en Turso CLI

### Prerrequisitos

```bash
# Verificar que turso CLI está instalado
turso --version

# Autenticarse (si no lo estás)
turso auth login
```

### 1. Listar bases de datos y branches activas

```bash
# Listar todas las bases de datos
turso db list

# Ver las branches de una base de datos específica
turso db show <nombre-db>
```

### 2. Ejecutar la migración en la branch principal

```bash
# Opción A: Ejecutar SQL directamente desde un string
turso db shell <nombre-db> \
  "ALTER TABLE tramites ADD COLUMN renewal_count INTEGER NOT NULL DEFAULT 0;"

turso db shell <nombre-db> \
  "CREATE TABLE IF NOT EXISTS tramite_renewal_history (
    id TEXT PRIMARY KEY NOT NULL,
    tramite_id TEXT NOT NULL,
    renewal_number INTEGER NOT NULL,
    user_id TEXT,
    previous_activation_date TEXT,
    previous_renovation_date TEXT,
    new_activation_date TEXT NOT NULL,
    new_renovation_date TEXT NOT NULL,
    previous_status TEXT,
    previous_liquidez_status TEXT,
    company_changed INTEGER NOT NULL DEFAULT 0,
    previous_company TEXT,
    new_company TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
  );"

turso db shell <nombre-db> \
  "CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_id ON tramite_renewal_history(tramite_id);"

turso db shell <nombre-db> \
  "CREATE INDEX IF NOT EXISTS idx_renewal_history_tramite_date ON tramite_renewal_history(tramite_id, created_at DESC);"

turso db shell <nombre-db> \
  "CREATE INDEX IF NOT EXISTS idx_renewal_history_user_id ON tramite_renewal_history(user_id);"

turso db shell <nombre-db> \
  "UPDATE tramites SET renewal_count = (
    SELECT COUNT(*) FROM tramite_changes
    WHERE tramite_changes.tramite_id = tramites.id
    AND tramite_changes.change_type IN ('renewal_created', 'renewal_updated')
  ) WHERE id IN (
    SELECT DISTINCT tramite_id FROM tramite_changes
    WHERE change_type IN ('renewal_created', 'renewal_updated')
  );"

# Opción B: Ejecutar desde un archivo SQL (recomendado)
turso db shell <nombre-db> < docs/migrations/renewal_flow_migration.sql
```

### 3. Migrar todas las branches activas

Las branches en Turso son copias independientes de la base de datos. Cada branch debe migrarse por separado.

```bash
# 1. Listar branches
turso db show <nombre-db>

# 2. Crear un script para migrar todas las branches
# Reemplaza <nombre-db> con el nombre real de tu base de datos

# Migrar branch principal (main)
turso db shell <nombre-db> < docs/migrations/renewal_flow_migration.sql

# Migrar branches adicionales (si existen)
# Las branches se acceden con el formato: <nombre-db>-<branch-name>
turso db shell <nombre-db> --branch <branch-name> < docs/migrations/renewal_flow_migration.sql
```

### 4. Script automatizado para todas las branches

```bash
#!/bin/bash
# migrate-all-branches.sh
# Uso: ./migrate-all-branches.sh <nombre-db> <ruta-sql>

DB_NAME=$1
SQL_FILE=$2

if [ -z "$DB_NAME" ] || [ -z "$SQL_FILE" ]; then
  echo "Uso: $0 <nombre-db> <ruta-archivo-sql>"
  exit 1
fi

echo "=== Migrando branch principal ==="
turso db shell "$DB_NAME" < "$SQL_FILE"
echo "✓ Branch principal migrada"

# Obtener lista de branches
BRANCHES=$(turso db show "$DB_NAME" --json 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if [ -n "$BRANCHES" ]; then
  for BRANCH in $BRANCHES; do
    if [ "$BRANCH" != "main" ]; then
      echo "=== Migrando branch: $BRANCH ==="
      turso db shell "$DB_NAME" --branch "$BRANCH" < "$SQL_FILE"
      echo "✓ Branch $BRANCH migrada"
    fi
  done
fi

echo ""
echo "=== Migración completada ==="
```

```bash
# Dar permisos de ejecución y ejecutar
chmod +x migrate-all-branches.sh
./migrate-all-branches.sh <nombre-db> docs/migrations/renewal_flow_migration.sql
```

### 5. Verificación post-migración

```bash
# Verificar en la branch principal
turso db shell <nombre-db> "SELECT name FROM sqlite_master WHERE type='table' AND name='tramite_renewal_history';"
turso db shell <nombre-db> "SELECT id, renewal_count FROM tramites LIMIT 3;"

# Verificar en una branch específica
turso db shell <nombre-db> --branch <branch-name> "SELECT name FROM sqlite_master WHERE type='table' AND name='tramite_renewal_history';"
```

---

## Notas importantes

- **Idempotencia**: Los `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS` permiten ejecutar la migración varias veces sin error.
- **ALTER TABLE**: El `ALTER TABLE ... ADD COLUMN` fallará si se ejecuta dos veces (la columna ya existe). Si necesitas re-ejecutar, verifica primero: `PRAGMA table_info(tramites);`
- **CHECK constraint de `tramite_changes`**: SQLite/Turso no permite modificar constraints con ALTER. El nuevo valor `renovation_completed` se valida a nivel de aplicación (tipo TypeScript). Verificar si Turso enforce el CHECK antes de decidir si recrear la tabla.
