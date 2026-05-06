# Integración Abarca → Negoco: Webhook de Resultados

## Índice

1. [Contexto y Objetivo](#1-contexto-y-objetivo)
2. [Arquitectura del Flujo](#2-arquitectura-del-flujo)
3. [Diseño del Endpoint Público](#3-diseño-del-endpoint-público)
4. [Modelo de Datos](#4-modelo-de-datos)
5. [Almacenamiento Firebase](#5-almacenamiento-firebase)
6. [Flujo de Conversión Comparativa → Trámite](#6-flujo-de-conversión-comparativa--trámite)
7. [Mapeo de Campos Abarca → Negoco](#7-mapeo-de-campos-abarca--negoco)
8. [Plan de Ejecución](#8-plan-de-ejecución)

---

## 1. Contexto y Objetivo

### Situación actual
1. Un usuario de Negoco abre el **AbarcaPanel** (Sheet lateral) desde la vista de una comparativa
2. Se llama a `POST /api/v2/integrations/abarca/login` con `ide` e `idcm` hardcodeados
3. Abarca devuelve un `login_url` que se carga en un iframe
4. El usuario realiza el estudio energético dentro del iframe
5. **Aquí se corta el flujo** — no hay forma de recibir los resultados de vuelta

### Objetivo
Crear un **endpoint webhook público** que Abarca pueda llamar cuando completa un estudio energético. Este endpoint:
- Recibe los datos del estudio (JSON) + archivo del estudio en base64
- Identifica a qué comparativa y organización corresponde
- Almacena el archivo en Firebase Storage
- Guarda los datos estructurados del estudio en la base de datos
- Actualiza el estado de la comparativa a `"completed"`
- Habilita la conversión automática a trámite con los datos pre-rellenados

---

## 2. Arquitectura del Flujo

```
┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│   Negoco         │     │     Abarca       │     │    Negoco API           │
│   Frontend       │     │   (Externo)      │     │    (Webhook)            │
├──────────────────┤     ├──────────────────┤     ├─────────────────────────┤
│                  │     │                  │     │                         │
│ 1. Clic en       │────►│                  │     │                         │
│    AbarcaPanel   │     │                  │     │                         │
│                  │     │                  │     │                         │
│ 1b. Registrar    │     │                  │     │                         │
│     sesión en    │     │                  │     │                         │
│     abarca_      │     │                  │     │                         │
│     sessions     │     │                  │     │                         │
│                  │     │                  │     │                         │
│ 2. Login con     │────►│ 3. Abre iframe   │     │                         │
│    iframe        │     │                  │     │                         │
│                  │     │                  │     │                         │
│ 4. Usuario       │────►│ 5. Realiza       │     │                         │
│    estudia en    │     │    estudio       │     │                         │
│    iframe        │     │                  │     │                         │
│                  │     │                  │     │                         │
│                  │     │ 6. Estudio       │────►│ 7. POST /api/          │
│                  │     │    completado    │     │    webhooks/abarca     │
│                  │     │    webhook call  │     │                         │
│                  │     │                  │     │                         │
│                  │     │                  │     │ 8.  Validar auth        │
│                  │     │                  │     │ 9.  Resolver tenant     │
│                  │     │                  │     │     (header x-tenant)   │
│                  │     │                  │     │ 10. Buscar sesión       │
│                  │     │                  │     │     pendiente (crm_id)  │
│                  │     │                  │     │     → comparativa_id    │
│                  │     │                  │     │ 11. Subir PDF/docs a    │
│                  │     │                  │     │     Firebase            │
│                  │     │                  │     │ 12. Guardar datos JSON  │
│                  │     │                  │     │ 13. Status → completed  │
│                  │     │                  │     │ 14. 200 OK              │
│                  │     │                  │     │                         │
│ 15. UI se        │◄────│                  │     │                         │
│     actualiza    │     │                  │     │                         │
│     (polling/    │     │                  │     │                         │
│      refresh)    │     │                  │     │                         │
└──────────────────┘     └──────────────────┘     └─────────────────────────┘
```

---

## 3. Diseño del Endpoint Público

### Ruta
```
POST /api/webhooks/abarca
```

### Autenticación
El endpoint es público (sin sesión de usuario) pero requiere autenticación mediante headers:

| Header | Valor | Descripción |
|--------|-------|-------------|
| `x-api-key` | `env.ABARCA_API_KEY` | API key compartida con Abarca |
| `x-tenant` | Subdominio del tenant | Identifica la base de datos Turso (ej: `empresa1`) |

**Validación** (api key + tenant):
```typescript
const apiKey = req.headers.get("x-api-key");
const tenant = req.headers.get("x-tenant");

if (!apiKey || apiKey !== process.env.ABARCA_API_KEY) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

if (!tenant) {
  return NextResponse.json({ error: "Missing tenant" }, { status: 400 });
}
```

### Request Body (simplificado)

Payload reducido a los campos que necesitamos de todo lo que Abarca envía. El tenant se recibe en headers, no en el body.

```typescript
interface AbarcaWebhookPayload {
  // --- Identificación ---
  ide: number;                   // ID fijo de Abarca (siempre 100)
  crm_id: number;                // ID de empresa en Abarca → maps to organization.abarca_user_id

  // --- Suministro ---
  cups: string;
  tipo_tarifa: string;           // "2.0TD", "3.0TD", etc.
  potencia_contratada: number;
  potencia_contratada_p2: number;

  // --- Empresas ---
  empresa_cliente: string;       // Comercializadora actual del cliente
  empresa: string;               // Comercializadora propuesta (ej: "NATURGY - POR USO LUZ")

  // --- Datos del titular ---
  titular: string;
  ape1: string;
  ape2: string;
  nombre_completo: string;
  dni: string;
  nif_empresa: boolean;
  autonomo: boolean;

  // --- Dirección del titular ---
  calle: string;
  numero: string;
  codpostal: string;
  localidad: string;

  // --- Dirección del CUPS ---
  calle_cups: string;
  numero_cups: string;
  localidad_cups: string;
  codpostal_cups: string;

  // --- Datos de contacto ---
  email: string;
  movil: string;
  iban: string;

  // --- Documentos en base64 ---
  dni_photo_front: string;       // Base64 (puede llegar vacío)
  dni_photo_back: string;        // Base64 (puede llegar vacío)
  justo_titulo: string;          // Base64 (solo si cambio de titularidad)
  estudio: string;               // Base64 — PDF del estudio energético

  // --- Banderas ---
  cambio_titularidad: boolean;
  tiene_placas: boolean;

  // --- Otros ---
  observaciones: string;
  servicios: string;
  permanencia: number;
  datos_crm: unknown[];          // Array de datos CRM internos de Abarca
}
```

> **Nota**: El campo `estudio` (PDF en base64) es obligatorio. El resto de documentos base64 solo se procesan si no están vacíos.

### Identificación de Comparativa (Session Tracking)

Abarca no conoce nuestro `comparativa_id` y no queremos enviárselo. La vinculación se resuelve internamente mediante **sesiones**:

1. **Al abrir AbarcaPanel**: Cuando el usuario inicia el comparador desde una comparativa específica, se registra una sesión pendiente en la tabla `abarca_sessions` con `(comparativa_id, crm_id, tenant, user_id)`
2. **Al recibir el webhook**: Se busca la sesión pendiente que coincida con `(crm_id, tenant)` más reciente → esto resuelve el `comparativa_id`
3. **Constraint**: Solo puede haber una sesión pendiente por `(crm_id, tenant, user_id)` a la vez. Al crear una nueva, solo las sesiones previas **de ese mismo usuario** se marcan como expiradas. Esto permite que múltiples usuarios trabajen con el comparador de Abarca simultáneamente sin interferir entre sí

```typescript
// Al abrir AbarcaPanel → POST /api/v2/integrations/abarca/login
// 1. Expirar sesiones previas del mismo usuario (crm_id+tenant+user_id)
await tursoClient.execute({
  sql: `UPDATE abarca_sessions SET status = 'expired' WHERE crm_id = ? AND tenant = ? AND user_id = ? AND status = 'pending'`,
  args: [crmId, tenant, userId]
});
// 2. Crear nueva sesión vinculada al usuario
await tursoClient.execute({
  sql: `INSERT INTO abarca_sessions (id, comparativa_id, crm_id, tenant, user_id, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
  args: [crypto.randomUUID(), comparativaId, crmId, tenant, userId]
});

// Al recibir webhook → POST /api/webhooks/abarca
// Nota: el webhook no sabe qué usuario lo generó, pero solo habrá una sesión
// pendiente más reciente por (crm_id, tenant)
const session = await tursoClient.execute({
  sql: `SELECT comparativa_id, user_id FROM abarca_sessions WHERE crm_id = ? AND tenant = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
  args: [payload.crm_id, tenant]
});
// session.rows[0].comparativa_id → la comparativa a actualizar
```

Tras procesar el webhook, la sesión se marca como `'completed'` y se almacena el `crm_id` de Abarca para referencia futura.

### Response

```typescript
// Éxito
{ "success": true }

// Error de autenticación
{ "error": "Unauthorized" }  // 401

// Error de validación / sin sesión pendiente
{ "error": "...", "details": [...] }  // 400

// Error interno
{ "error": "Internal server error" }  // 500
```

---

## 4. Modelo de Datos

### 4.1 Migración: tabla `organization`

Añadir columna `abarca_user_id` para vincular la organización con el `crm_id`/`idcm` de Abarca:

```sql
ALTER TABLE organization ADD COLUMN abarca_user_id INTEGER DEFAULT NULL;
```

Este campo almacena el `crm_id` (equivalente a `idcm` en el login) que identifica a la organización en Abarca, permitiendo verificar que el webhook pertenece a la organización correcta del tenant. **No confundir con `ide`**, que es un valor fijo (siempre 100).

### 4.2 Nueva tabla: `abarca_estudios`

Almacena los datos simplificados que Abarca envía para cada estudio:

```sql
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
```

### 4.3 ¿Por qué tabla separada y no extender `comparativas`?

| Opción | Pros | Contras |
|--------|------|---------|
| Extender `comparativas` | Menos JOINs | 30+ columnas nuevas, contamina tabla core, no todas las comparativas vendrán de Abarca |
| **Tabla `abarca_estudios`** | **Separación limpia, extensible, raw_payload como respaldo** | **Un JOIN cuando se necesitan datos** |

La tabla separada con `raw_payload` (JSON completo) permite:
- Acceder a cualquier campo sin migración adicional
- Facilitar debugging y auditoría
- Extender sin impactar el schema de comparativas

### 4.4 Nueva tabla: `abarca_sessions`

Resuelve la vinculación `comparativa_id ↔ estudio de Abarca` sin enviar nuestros IDs a Abarca:

```sql
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
```

**Flujo de vida de una sesión**:
1. `pending` → Se crea cuando el usuario abre AbarcaPanel (solo las sesiones previas **del mismo usuario** con `crm_id`+`tenant`+`user_id` se marcan como `expired`)
2. `completed` → El webhook llegó y se procesó correctamente
3. `expired` → El mismo usuario abrió una nueva sesión antes de que el webhook llegara (cambió de comparativa)

**Multi-usuario**: Cada usuario tiene su propia sesión pendiente independiente. Si Usuario A abre una comparativa y Usuario B abre otra, ambas sesiones coexisten como `pending`. Solo cuando un mismo usuario abre una nueva sesión se expiran sus sesiones anteriores.

---

## 5. Almacenamiento Firebase

### 5.1 Estructura de carpetas

```
/{organization_id}/
  comparativas/
    {comparativa_id}/
      estudio_abarca.pdf           ← PDF del estudio
      dni_frontal.jpg              ← Si se recibe
      dni_reverso.jpg              ← Si se recibe
      justo_titulo.pdf             ← Si hay cambio de titularidad
```

### 5.2 Proceso de subida

1. **Decodificar base64** → `Buffer`
2. **Crear `File` object** (o usar `uploadBytes` directo con el buffer)
3. **Subir a Firebase** usando el patrón existente: `ref(storage, path)` → `uploadBytes` → `getDownloadURL`
4. **Registrar en `comparativa_files`** con metadata (filename, size, extension, download_url)

```typescript
// Pseudo-código
const pdfBuffer = Buffer.from(payload.estudio, "base64");
const storagePath = `${organizationId}/comparativas/${comparativaId}/estudio_abarca.pdf`;
const storageRef = ref(storage, storagePath);
await uploadBytes(storageRef, pdfBuffer, { contentType: "application/pdf" });
const downloadURL = await getDownloadURL(storageRef);
```

### 5.3 Archivos opcionales

Solo subir si el campo base64 no es vacío:
- `dni_photo_front` → `dni_frontal.jpg`
- `dni_photo_back` → `dni_reverso.jpg`  
- `justo_titulo` → `justo_titulo.pdf`

---

## 6. Flujo de Conversión Comparativa → Trámite

### 6.1 Estado actual del flujo
1. Comparativa en `status: "completed"` habilita `AddTramiteDialog`
2. El `ComparativaToTramiteStep` muestra resumen y el usuario selecciona plan (fijo/indexado)
3. `createEmptyClientDB(comparativa)` crea un ClientDB con solo el `name` de la comparativa
4. El usuario rellena manualmente: email, teléfono, dirección, DNI, IBAN, contratos, etc.
5. Los formularios (Steps 2-5) requieren completar todos estos datos a mano

### 6.2 Flujo mejorado con datos de Abarca

Con los datos de Abarca almacenados en `abarca_estudios`, el flujo cambia significativamente:

```
Comparativa (status: completed)
    │
    ▼
ComparativaToTramiteStep ← Muestra resumen + datos Abarca
    │
    ▼
createEmptyClientDB(comparativa, abarcaEstudio) ← Pre-rellena con datos Abarca
    │
    ├── name: nombre_completo → split nombre/apellidos
    ├── email: email
    ├── phone: movil
    ├── address: calle + numero
    ├── postal_code: codpostal
    ├── city: localidad
    ├── document_type: nif_empresa ? "CIF" : "DNI"
    ├── document_number: dni
    ├── IBAN: iban
    └── type: nif_empresa ? "Empresa" : "Particular"
    │
    ▼
createEmptyContractDB(abarcaEstudio) ← Pre-rellena contrato
    │
    ├── CUPS: cups
    ├── type: comparativa.service (Luz/Gas)
    ├── address: calle_cups + numero_cups
    ├── postal_code: codpostal_cups
    ├── city: localidad_cups
    ├── old_company: empresa_cliente
    ├── new_company: empresa
    ├── pot1: potencia_contratada
    └── pot2: potencia_contratada_p2
    │
    ▼
FourthStepForm ← Documentos ya adjuntos (estudio PDF, DNI si aplica)
    │
    ▼
ReviewStep → Submit
```

### 6.3 Cómo obtener los datos de Abarca en el frontend

Opción más limpia: **extender el endpoint GET `/api/v2/comparisons/[id]`** para incluir los datos del estudio cuando existan.

```typescript
// En el endpoint GET de comparativa por ID
const abarcaResult = await tursoClient.execute({
  sql: "SELECT * FROM abarca_estudios WHERE comparativa_id = ?",
  args: [id]
});

// Incluir en la respuesta si existe
if (abarcaResult.rows.length > 0) {
  comparativaVM.abarca_estudio = abarcaResult.rows[0];
}
```

Esto requiere extender `ComparativaVM`:
```typescript
export interface ComparativaVM {
  // ... campos existentes ...
  abarca_estudio?: AbarcaEstudio;  // Datos del estudio si existe
}
```

---

## 7. Mapeo de Campos Abarca → Negoco

### 7.1 Abarca → ClientDB

| Campo Abarca | → | Campo ClientDB | Transformación |
|---|---|---|---|
| `nombre_completo` | → | `name` + `last_name` | Split por primer espacio o parsear `titular`/`ape1`/`ape2` |
| `email` | → | `email` | Directo |
| `movil` | → | `phone` | Directo |
| `calle` + `numero` | → | `address` | Concatenar |
| `codpostal` | → | `postal_code` | Directo |
| `localidad` | → | `city` | Directo |
| `nif_empresa` | → | `type` | `false` → "Particular", `true` → "Empresa" |
| `dni` | → | `document_number` | Directo |
| `nif_empresa` | → | `document_type` | `false` → "DNI", `true` → "CIF" |
| `iban` | → | `IBAN` | Directo |

### 7.2 Abarca → ContractDB

| Campo Abarca | → | Campo ContractDB | Transformación |
|---|---|---|---|
| `comparativa.service` | → | `type` | Del campo `service` de la comparativa (Luz/Gas) |
| `calle_cups` + `numero_cups` | → | `address` | Concatenar |
| `codpostal_cups` | → | `postal_code` | Directo |
| `localidad_cups` | → | `city` | Directo |
| `empresa_cliente` | → | `old_company` | Directo (o resolver por ID en comercializadoras) |
| `empresa` | → | `new_company` | Directo (o resolver por ID en comercializadoras) |
| `cups` | → | `CUPS` | Directo |
| `potencia_contratada` | → | `pot1` | Convertir a entero si es necesario |
| `potencia_contratada_p2` | → | `pot2` | Convertir a entero si es necesario |

### 7.3 Abarca → Datos de comparativa

| Campo Abarca | → | Campo Comparativa | Nota |
|---|---|---|---|
| `empresa` | → | `company_id` | Buscar en tabla `comercializadoras` por nombre |

---

## 8. Plan de Ejecución

### Fase 1: Infraestructura de Base de Datos

#### 1.1 Migración de `organization`
- **Archivo**: Ejecutar SQL en cada tenant
- **SQL**: `ALTER TABLE organization ADD COLUMN abarca_user_id INTEGER DEFAULT NULL;`
- **Acción manual**: Configurar el valor de `abarca_user_id` para cada organización que use Abarca
- **Actualizar tipo**: Añadir `abarca_user_id?: number` a la interfaz `Organization` en `src/core/types.ts`

#### 1.2 Crear tabla `abarca_estudios`
- **Archivo**: Ejecutar SQL en cada tenant
- **SQL**: El CREATE TABLE definido en la sección 4.2
- **Tipo**: Crear `src/comparativas/types/abarca.types.ts` con la interfaz `AbarcaEstudio`

#### 1.3 Crear tabla `abarca_sessions`
- **Archivo**: Ejecutar SQL en cada tenant
- **SQL**: El CREATE TABLE definido en la sección 4.4 (incluye `user_id TEXT NOT NULL`)
- **Índices**: `idx_abarca_sessions_lookup`, `idx_abarca_sessions_user`, `idx_abarca_sessions_comparativa`

#### 1.4 Crear función de resolución de tenant por nombre
- **Archivo**: `src/core/libsql/client.ts`
- **Acción**: Añadir función `getTursoClientByTenant(tenant: string)` que construya las env vars dinámicamente sin depender del header `host`
```typescript
export const getTursoClientByTenant = (tenant: string) => {
  const tursoUrl = process.env[`NEXT_TURSO_DB_URL_${tenant.toUpperCase()}`];
  const tursoAuth = process.env[`NEXT_TURSO_DB_AUTH_TOKEN_${tenant.toUpperCase()}`];
  if (!tursoUrl || !tursoAuth) throw new Error(`Missing config for tenant: ${tenant}`);
  return createClient({ url: tursoUrl, authToken: tursoAuth });
};
```

### Fase 2: Endpoint Webhook

#### 2.1 Crear el endpoint
- **Archivo**: `src/app/api/webhooks/abarca/route.ts`
- **Método**: `POST`
- **Flujo**:
  1. Validar header de autenticación (`x-api-key`)
  2. Parsear body JSON
  3. Validar schema con Zod
  4. Resolver tenant → DB client
  5. Verificar `organization.abarca_user_id` coincide con `crm_id`
  6. Verificar que la comparativa existe y está en estado `"pending"`
  7. Decodificar archivos base64 y subir a Firebase
  8. Registrar archivos en `comparativa_files`
  9. Insertar registro en `abarca_estudios`
  10. Actualizar `comparativas.status` → `"completed"` + `company_id` si se resuelve
  11. Registrar cambio en `comparativa_changes`
  12. Responder `200 { success: true }`

#### 2.2 Validación Zod del payload
- **Archivo**: Mismo archivo del endpoint o `src/comparativas/types/abarca.types.ts`
- **Schema**: Definir `AbarcaWebhookSchema` con los campos obligatorios y opcionales

#### 2.3 Helper para subir base64 a Firebase
- **Archivo**: `src/core/firebase/data/uploadBase64File.ts`
- **Función**: `uploadBase64File(base64: string, storagePath: string, contentType: string)`
- Reutiliza `ref`, `uploadBytes`, `getDownloadURL` del patrón existente

### Fase 3: Session Tracking (multiusuario)

#### 3.1 Registrar sesión al iniciar comparador
- **Problema**: Abarca no conoce nuestros IDs internos y no queremos enviarlos. Además, varios usuarios pueden usar el comparador simultáneamente.
- **Solución**: Al hacer login en Abarca, registrar una sesión interna en `abarca_sessions` con `(comparativa_id, ide, tenant, user_id)`. Solo se expiran las sesiones previas **del mismo usuario**.
- **Archivos a modificar**:
  - `src/app/api/v2/integrations/abarca/login/route.ts` — Recibir `comparativa_id` y `user_id` en el body, registrar sesión en `abarca_sessions` (expirar previas del mismo usuario, crear nueva)
  - `src/comparativas/components/details/AbarcaPanel.tsx` — Pasar `comparativa_id` y `user_id` al endpoint de login

#### 3.2 Actualizar AbarcaPanel para recibir props
- **Archivo**: `src/comparativas/components/details/AbarcaPanel.tsx`
- **Cambio**: Recibir `comparativaId` y `userId` como props y enviarlos en el login
- **Archivo**: `src/comparativas/components/details/MainView.tsx`
- **Cambio**: Pasar `comparativaId={comparativa.id}` y `userId={user.id}` al componente

### Fase 4: Extensión del Frontend

#### 4.1 Extender `ComparativaVM` con datos de Abarca
- **Archivo**: `src/comparativas/types/comparativa.types.ts`
- **Cambio**: Añadir `abarca_estudio?: AbarcaEstudio` como campo opcional

#### 4.2 Incluir datos de Abarca en el GET de comparativa
- **Archivo**: `src/app/api/v2/comparisons/[id]/route.ts`
- **Cambio**: JOIN con `abarca_estudios` (o query separada) e incluir en la respuesta

#### 4.3 Mejorar factories de creación de trámite
- **Archivo**: `src/tramites/utils/tramite.factories.ts`
- **Cambios**:
  - `createEmptyClientDB(comparativa)` → Usar `abarca_estudio` para pre-rellenar name, email, phone, address, DNI, IBAN, etc.
  - Crear `createContractFromAbarca(abarcaEstudio, tramiteId)` para pre-rellenar contrato

#### 4.4 Pre-rellenar formularios de trámite
- **Archivos**: `SecondStepForm.tsx`, `ThirdStepForm.tsx`
- **Cambio**: Los formularios recibirán datos pre-rellenados desde las factories. Los campos se mostrarán con los datos de Abarca como valores por defecto que el usuario puede editar.

### Fase 5: Testing y Coordinación

#### 5.1 Testing del webhook
- Crear tests con payload de ejemplo (`docs/abarca/abarca.json`)
- Verificar autenticación rechaza requests sin credenciales
- Verificar flujo completo: webhook → DB → Firebase → status update

#### 5.2 Coordinación con Abarca
- Confirmar formato exacto del webhook payload
- Confirmar headers de autenticación que usarán
- Acordar uso del header `x-tenant` para identificar el tenant
- Confirmar si el `estudio` (PDF base64) viene en el mismo request o en un campo separado
- Acordar campo para el archivo del estudio en el JSON (asumimos `estudio`)
- Proporcionar URL del webhook a Abarca para su configuración

#### 5.3 Configurar CORS si es necesario
- **Archivo**: `cors.json` (existe en la raíz)
- Verificar que el endpoint webhook permita requests desde el dominio de Abarca

### Resumen de archivos a crear/modificar

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| **Crear** | `src/app/api/webhooks/abarca/route.ts` | Endpoint webhook |
| **Crear** | `src/comparativas/types/abarca.types.ts` | Tipos e interfaz del estudio |
| **Crear** | `src/core/firebase/data/uploadBase64File.ts` | Helper para subir base64 |
| Modificar | `src/core/libsql/client.ts` | Añadir `getTursoClientByTenant` |
| Modificar | `src/core/types.ts` | Añadir `abarca_user_id` a `Organization` |
| Modificar | `src/comparativas/types/comparativa.types.ts` | Añadir `abarca_estudio?` a `ComparativaVM` |
| Modificar | `src/app/api/v2/comparisons/[id]/route.ts` | Incluir datos Abarca en GET |
| Modificar | `src/comparativas/components/details/AbarcaPanel.tsx` | Pasar `comparativa_id` y `user_id` |
| Modificar | `src/comparativas/components/details/MainView.tsx` | Props a AbarcaPanel |
| Modificar | `src/app/api/v2/integrations/abarca/login/route.ts` | Registrar sesión en `abarca_sessions` |
| Modificar | `src/tramites/utils/tramite.factories.ts` | Pre-rellenar con datos Abarca |
| **SQL** | Migración en cada tenant | `ALTER TABLE organization`, `CREATE TABLE abarca_estudios`, `CREATE TABLE abarca_sessions` |

### Orden de ejecución recomendado

```
Fase 1 (Base de datos)        → Sin dependencias
Fase 2 (Webhook endpoint)     → Depende de Fase 1
Fase 3 (Session tracking)     → Depende de Fase 1 (sin coordinación externa)
Fase 4 (Frontend)             → Depende de Fases 1-3
Fase 5 (Testing)              → Depende de Fases 1-4
```

Las Fases 1, 2 y 3 se pueden ejecutar completamente sin depender de Abarca (el session tracking es interno). Las Fases 2 y 3 se pueden desarrollar en paralelo. La Fase 5 requiere coordinar con Abarca solo para confirmar el formato del webhook y proporcionar la URL.
