# Testing del Webhook Abarca con Postman

## Requisitos previos

### 1. Tablas en la base de datos

Asegúrate de que las tablas `abarca_sessions` y `abarca_estudios` existen en la DB del tenant de prueba. Si no las has creado aún:

```sql
CREATE TABLE IF NOT EXISTS abarca_sessions (
  id TEXT PRIMARY KEY,
  comparativa_id TEXT NOT NULL,
  crm_id INTEGER NOT NULL,
  tenant TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_abarca_sessions_lookup ON abarca_sessions(crm_id, tenant, status);

CREATE TABLE IF NOT EXISTS abarca_estudios (
  id TEXT PRIMARY KEY,
  comparativa_id TEXT NOT NULL UNIQUE,
  crm_id INTEGER NOT NULL,
  ide INTEGER NOT NULL,
  cups TEXT NOT NULL,
  tipo_tarifa TEXT,
  potencia_contratada REAL,
  potencia_contratada_p2 REAL,
  empresa_cliente TEXT,
  empresa TEXT,
  nombre_completo TEXT,
  titular TEXT,
  ape1 TEXT,
  ape2 TEXT,
  dni TEXT,
  nif_empresa INTEGER DEFAULT 0,
  autonomo INTEGER DEFAULT 0,
  calle TEXT,
  numero TEXT,
  codpostal TEXT,
  localidad TEXT,
  calle_cups TEXT,
  numero_cups TEXT,
  codpostal_cups TEXT,
  localidad_cups TEXT,
  email TEXT,
  movil TEXT,
  iban TEXT,
  cambio_titularidad INTEGER DEFAULT 0,
  tiene_placas INTEGER DEFAULT 0,
  observaciones TEXT,
  servicios TEXT,
  permanencia INTEGER DEFAULT 0,
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (comparativa_id) REFERENCES comparativas(id) ON DELETE CASCADE
);
```

Y la columna `abarca_user_id` en `organization`:

```sql
ALTER TABLE organization ADD COLUMN abarca_user_id INTEGER DEFAULT NULL;
```

### 2. Datos de prueba en la base de datos

Necesitas 3 cosas en la DB del tenant TEST:

#### a) Configurar `abarca_user_id` en la organización

```sql
-- Primero verifica el id de tu organización
SELECT id, name, abarca_user_id FROM organization;

-- Actualiza con el crm_id que usarás en el test (ej: 4285)
UPDATE organization SET abarca_user_id = 4285 WHERE id = '<TU_ORG_ID>';
```

#### b) Tener una comparativa existente

```sql
-- Verifica que tienes al menos una comparativa
SELECT id, client, status FROM comparativas LIMIT 5;
```

Anota el `id` de la comparativa que quieras usar. Puede estar en cualquier estado.

#### c) Crear una sesión pendiente

```sql
-- Reemplaza los valores entre < >
INSERT INTO abarca_sessions (id, comparativa_id, crm_id, tenant, user_id, status)
VALUES (
  '<UUID_RANDOM>',         -- Genera uno: SELECT hex(randomblob(16))
  '<COMPARATIVA_ID>',      -- El id de la comparativa del paso anterior
  4285,                    -- Debe coincidir con organization.abarca_user_id
  'test',                  -- El tenant (para localhost usa 'test')
  '<USER_ID>',             -- Un user_id válido de la tabla user
  'pending'
);

-- Verificar
SELECT * FROM abarca_sessions WHERE status = 'pending';
```

### 3. Servidor local corriendo

```bash
npm run dev
```

---

## Configuración en Postman

### Request

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **URL** | `http://localhost:3000/api/webhooks/abarca` |

### Headers

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |
| `x-api-key` | `sO]G>rm090/@` |
| `x-tenant` | `test` |

### Body (raw JSON)

```json
{
  "ide": 100,
  "crm_id": 1051,
  "cups": "ES0021000015543129GW0F",
  "tipo_tarifa": "2.0TD",
  "potencia_contratada": 5.5,
  "potencia_contratada_p2": 5.5,
  "empresa_cliente": "ENDESA ENERGÍA S.A.U.",
  "empresa": "NATURGY - POR USO LUZ",
  "titular": "BAS",
  "ape1": "ASENJO",
  "ape2": "MARIA DOLORES",
  "nombre_completo": "BAS ASENJO, MARIA DOLORES",
  "dni": "25403784P",
  "nif_empresa": false,
  "autonomo": false,
  "calle": "Calle PJ LA SIRENA, 3",
  "numero": "3",
  "codpostal": "46460",
  "localidad": "SILLA",
  "calle_cups": "Calle PJ LA SIRENA, 3",
  "numero_cups": "3",
  "localidad_cups": "SILLA",
  "codpostal_cups": "46460",
  "email": "dolores.bas@gmail.com",
  "movil": "606010041",
  "iban": "ES1921001417290200096229",
  "cambio_titularidad": false,
  "tiene_placas": false,
  "observaciones": "",
  "servicios": "",
  "permanencia": 0,
  "dni_photo_front": "",
  "dni_photo_back": "",
  "justo_titulo": "",
  "datos_crm": []
}
```

> **Nota**: Los campos `dni_photo_front`, `dni_photo_back`, `justo_titulo` y `estudio` están vacíos. Los archivos base64 vacíos se ignoran (no se suben a Firebase). Si quieres probar la subida de archivos, puedes poner un base64 real en `estudio`.

---

## Respuestas esperadas

### Éxito (200)

```json
{ "success": true }
```

**Qué ocurre internamente:**
- Se insertan archivos en `comparativa_files` (si hay base64 no vacíos)
- Se crea un registro en `abarca_estudios` con todos los datos
- La comparativa pasa a status `completed`
- La sesión en `abarca_sessions` pasa a status `completed`
- Se registra el cambio en `comparativa_changes`

### Errores comunes

| Status | Error | Causa |
|--------|-------|-------|
| `401` | `Unauthorized` | `x-api-key` incorrecto o ausente |
| `400` | `Missing tenant` | Falta el header `x-tenant` |
| `400` | `Invalid tenant` | No existe la configuración de DB para ese tenant |
| `400` | `Validation error` | El body no pasa la validación Zod (revisa `details`) |
| `403` | `crm_id does not match organization` | El `crm_id` del body no coincide con `organization.abarca_user_id` |
| `400` | `No pending session found for this crm_id` | No hay sesión pendiente en `abarca_sessions` |
| `404` | `Comparativa not found` | La comparativa de la sesión no existe |
| `404` | `Not found` | Estás accediendo desde un host distinto a `api.` o `localhost` |

---

## Verificar resultados

Después de un `200 OK`, ejecuta estas queries:

```sql
-- 1. La sesión debe estar 'completed'
SELECT * FROM abarca_sessions ORDER BY created_at DESC LIMIT 1;

-- 2. Debe existir el estudio
SELECT id, comparativa_id, cups, nombre_completo, email FROM abarca_estudios ORDER BY created_at DESC LIMIT 1;

-- 3. La comparativa debe estar en status 'completed'
SELECT id, client, status FROM comparativas WHERE id = '<COMPARATIVA_ID>';

-- 4. Se registró el cambio
SELECT * FROM comparativa_changes WHERE comparativa_id = '<COMPARATIVA_ID>' ORDER BY created_at DESC LIMIT 3;

-- 5. Archivos (solo si enviaste base64 no vacíos)
SELECT * FROM comparativa_files WHERE comparativa_id = '<COMPARATIVA_ID>';
```

---

## Para repetir el test

Si quieres volver a ejecutar el test con la misma comparativa:

```sql
-- 1. Eliminar el estudio anterior
DELETE FROM abarca_estudios WHERE comparativa_id = '<COMPARATIVA_ID>';

-- 2. Volver la comparativa a pending
UPDATE comparativas SET status = 'pending' WHERE id = '<COMPARATIVA_ID>';

-- 3. Crear nueva sesión pendiente
INSERT INTO abarca_sessions (id, comparativa_id, crm_id, tenant, user_id, status)
VALUES (
  hex(randomblob(16)),
  '<COMPARATIVA_ID>',
  4285,
  'test',
  '<USER_ID>',
  'pending'
);
```

---

## Test en producción

En producción el webhook solo es accesible desde `api.negococloud.es`:

| Campo | Valor |
|-------|-------|
| **URL** | `https://api.negococloud.es/api/webhooks/abarca` |
| **x-tenant** | El subdominio del tenant (ej: `empresa1`) |

El resto de headers y body es idéntico.
