# Plan de Implementación: Mejora del Flujo de Renovación de Trámites

## Resumen

Reestructurar el diálogo de renovación (`RenewTramiteConfirmationDialog.tsx`) y el endpoint API (`/api/v2/contracts/[id]/renewal`) para incluir: actualización del tipo de contrato, cambio de estado y liquidez, soporte para cambio de compañía, edición de fechas, registro exhaustivo en `tramite_changes`, contador de renovaciones en `tramites`, y tabla dedicada `tramite_renewal_history` con snapshot completo de cada renovación.

---

## Estado actual

| Componente | Situación actual |
|---|---|
| `RenewTramiteConfirmationDialog.tsx` | Solo llama a POST `/api/v2/contracts/{id}/renewal` sin cuerpo relevante. Muestra fechas calculadas como solo lectura. |
| Endpoint `POST /api/v2/contracts/[id]/renewal` | Actualiza `activation_date = NOW` y `renovation_date = NOW + 1 año`. No toca `status`, `liquidez_status`, tipo de contrato ni compañías. |
| `tramite_changes` | Se registran cambios de fechas de activación/renovación con `change_type = 'field_update'`. No existe `renovation_completed` como tipo válido. |
| Tabla `contracts` | Tiene `type`, `old_company`, `new_company` por contrato. |
| Tabla `tramites` | Tiene `status`, `liquidez_status`. No tiene contador de renovaciones. |
| Tabla `tramite_renewal_history` | No existe. No hay registro dedicado de renovaciones. |

---

## Cambios requeridos

### 1. Schema: Nuevo `change_type` en `tramite_changes`

**Archivo:** `docs/schema.sql` + migración SQL

Añadir `'renovation_completed'` al CHECK constraint de `tramite_changes.change_type`.

```sql
-- Migración
ALTER TABLE tramite_changes DROP CONSTRAINT IF EXISTS tramite_changes_change_type_check;
-- En SQLite no se puede ALTER CHECK, hay que recrear la tabla o deshabilitar el check.
-- Opción pragmática: SQLite no enforce CHECK constraints por defecto en ALTER.
-- Se recomienda añadir el valor al schema doc y al tipo TypeScript.
```

**Archivo:** `src/tramites/types/tramite-changes.types.ts`

Añadir `'renovation_completed'` al tipo `TramiteChangeType`.

---

### 2. Schema: Columna `renewal_count` en `tramites`

**Archivo:** `docs/schema.sql` + migración SQL

Añadir columna `renewal_count` a la tabla `tramites` para saber de un vistazo cuántas veces se ha renovado un trámite.

```sql
ALTER TABLE tramites ADD COLUMN renewal_count INTEGER NOT NULL DEFAULT 0;
```

**Archivo:** `src/tramites/types/tramite.types.ts`

Añadir `renewal_count: number` a `TramiteDB`.

---

### 3. Schema: Nueva tabla `tramite_renewal_history`

**Archivo:** `docs/schema.sql` + migración SQL

Tabla dedicada que almacena un snapshot completo por cada renovación, facilitando consultas directas sin filtrar `tramite_changes`.

```sql
CREATE TABLE tramite_renewal_history (
    id TEXT PRIMARY KEY NOT NULL,
    tramite_id TEXT NOT NULL,
    renewal_number INTEGER NOT NULL,              -- Nº de renovación (1, 2, 3...)
    user_id TEXT,                                  -- Quién ejecutó la renovación
    
    -- Snapshot de fechas anteriores
    previous_activation_date TEXT,
    previous_renovation_date TEXT,
    
    -- Nuevas fechas asignadas
    new_activation_date TEXT NOT NULL,
    new_renovation_date TEXT NOT NULL,
    
    -- Estado anterior
    previous_status TEXT,
    previous_liquidez_status TEXT,
    
    -- Información de compañía
    company_changed INTEGER NOT NULL DEFAULT 0,    -- 0 = no, 1 = sí
    previous_company TEXT,                         -- new_company antes de renovar
    new_company TEXT,                              -- nueva compañía (o misma si no cambió)
    
    -- Metadatos
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
);

CREATE INDEX idx_renewal_history_tramite_id ON tramite_renewal_history(tramite_id);
CREATE INDEX idx_renewal_history_tramite_date ON tramite_renewal_history(tramite_id, created_at DESC);
CREATE INDEX idx_renewal_history_user_id ON tramite_renewal_history(user_id);
```

**Archivo:** `src/tramites/types/tramite-renewal-history.types.ts` (nuevo)

```typescript
export interface TramiteRenewalHistory {
  id: string;
  tramite_id: string;
  renewal_number: number;
  user_id: string | null;
  previous_activation_date: string | null;
  previous_renovation_date: string | null;
  new_activation_date: string;
  new_renovation_date: string;
  previous_status: string | null;
  previous_liquidez_status: string | null;
  company_changed: boolean;
  previous_company: string | null;
  new_company: string | null;
  created_at: string;
  // Joins opcionales
  user_name?: string | null;
}
```

---

### 4. Frontend: `RenewTramiteConfirmationDialog.tsx`

#### 4.1 Nuevo estado del formulario

```typescript
interface RenewalFormData {
  activation_date: Date;       // Nueva activation_date (era renovation_date anterior)
  renovation_date: Date;       // activation_date + 1 año
  company_changed: boolean;    // Switch: ¿cambio de compañía?
  new_company_id: string;      // ID de la nueva comercializadora (si aplica)
}
```

**Valores iniciales:**
- `activation_date` → `new Date(tramite.renovation_date)` (la fecha de renovación actual pasa a ser la nueva activation_date)
- `renovation_date` → `activation_date + 1 año`
- `company_changed` → `false`
- `new_company_id` → `""` (vacío)

#### 4.2 Componentes UI a añadir

| Componente | Descripción |
|---|---|
| **DatePicker × 2** | Para `activation_date` y `renovation_date`, editables. Mismo patrón que `UpdateTramiteStatusModal.tsx`: al cambiar `activation_date`, `renovation_date` se recalcula a +1 año. |
| **Switch "Cambio de compañía"** | Toggle. Al activar, muestra el Select. |
| **Select de comercializadoras** | Usa `useActiveEnergySuppliers()`. Muestra solo comercializadoras activas. Aparece condicionalmente cuando `company_changed = true`. |

#### 4.3 Lógica de fechas (mismo patrón que `UpdateTramiteStatusModal`)

```typescript
const handleDateChange = (date: Date, name: string) => {
  if (date) {
    setFormData((prev) => ({
      ...prev,
      [name]: date,
      ...(name === "activation_date" && {
        renovation_date: new Date(
          date.getFullYear() + 1,
          date.getMonth(),
          date.getDate()
        ),
      }),
    }));
  }
};
```

#### 4.4 Payload del submit

```typescript
const body = {
  user_id: userData.id,
  activation_date: formData.activation_date.toISOString(),
  renovation_date: formData.renovation_date.toISOString(),
  company_changed: formData.company_changed,
  new_company_id: formData.company_changed ? formData.new_company_id : undefined,
};
```

#### 4.5 Validaciones antes del submit

- Si `company_changed === true`, verificar que `new_company_id` no esté vacío.
- Las fechas deben ser válidas.

---

### 5. Backend: Endpoint `POST /api/v2/contracts/[id]/renewal`

#### 5.1 Nuevo schema de validación del body

```typescript
const RenewalBodySchema = z.object({
  user_id: z.string().min(1),
  activation_date: z.string().datetime(),
  renovation_date: z.string().datetime(),
  company_changed: z.boolean().default(false),
  new_company_id: z.string().optional(),
});
```

#### 5.2 Operaciones en la base de datos (transacción)

Todas las operaciones dentro de una **transacción** para garantizar atomicidad:

```
BEGIN TRANSACTION
│
├─ 1. Leer estado actual del trámite (activation_date, renovation_date, status,
│     liquidez_status, renewal_count)
├─ 2. Leer contratos asociados (old_company, new_company, type)
│
├─ 3. UPDATE tramites:
│     SET status = 'Pendiente de Firma',
│         liquidez_status = NULL,
│         activation_date = :activation_date,
│         renovation_date = :renovation_date,
│         renewal_count = renewal_count + 1
│     WHERE id = :id
│
├─ 4. UPDATE contracts (para CADA contrato del trámite):
│     SET type = 'Renovación'
│     Si company_changed:
│       SET old_company = new_company,     -- la compañía actual pasa a ser "anterior"
│           new_company = :new_company_id  -- la seleccionada es la nueva
│     WHERE tramite_id = :id
│
├─ 5. INSERT tramite_renewal_history:
│     Snapshot completo de la renovación (ver sección 7)
│
├─ 6. Registros en tramite_changes (ver sección 6)
│
COMMIT
```

#### 5.3 Respuesta

```json
{ "success": true }
```

En caso de error, rollback automático y:
```json
{ "success": false, "error": "mensaje descriptivo" }
```

---

### 6. Registros de cambios en `tramite_changes`

Se crearán **múltiples registros** por cada renovación para trazabilidad completa:

#### 6.1 Cambio de estado

| Campo | Valor |
|---|---|
| `change_type` | `status_change` |
| `field_name` | `status` |
| `old_value` | Estado anterior (e.g., `Activo`) |
| `new_value` | `Pendiente de Firma` |
| `description` | `Renovación: Estado cambiado de "Activo" a "Pendiente de Firma"` |

#### 6.2 Reset de liquidez

| Campo | Valor |
|---|---|
| `change_type` | `field_update` |
| `field_name` | `liquidez_status` |
| `old_value` | Estado anterior (e.g., `Cobrado por Comercializadora`) |
| `new_value` | `NULL` |
| `description` | `Renovación: Estado de liquidez reiniciado` |

#### 6.3 Cambio de fechas (activation_date)

| Campo | Valor |
|---|---|
| `change_type` | `date_update` |
| `field_name` | `activation_date` |
| `old_value` | Fecha anterior |
| `new_value` | Nueva fecha |
| `description` | `Renovación: Fecha de activación actualizada de {old} a {new}` |

#### 6.4 Cambio de fechas (renovation_date)

| Campo | Valor |
|---|---|
| `change_type` | `date_update` |
| `field_name` | `renovation_date` |
| `old_value` | Fecha anterior |
| `new_value` | Nueva fecha |
| `description` | `Renovación: Fecha de renovación actualizada de {old} a {new}` |

#### 6.5 Tipo de contrato

| Campo | Valor |
|---|---|
| `change_type` | `contract_updated` |
| `field_name` | `contract.type` |
| `old_value` | Tipo anterior (e.g., `Cambio Compañía`) |
| `new_value` | `Renovación` |
| `description` | `Renovación: Tipo de contrato actualizado a "Renovación"` |

#### 6.6 Renovación completada (registro resumen)

| Campo | Valor |
|---|---|
| `change_type` | `renovation_completed` |
| `field_name` | `company` |
| `old_value` | Compañía anterior (`new_company` antes de la renovación) |
| `new_value` | Compañía nueva (la seleccionada, o la misma si no hubo cambio) |
| `description` | **Con cambio:** `Contrato renovado y cambio de compañía de "{old}" a "{new}"` |
|  | **Sin cambio:** `Contrato renovado, sin cambio de compañía "{old}" a "{new}"` |

#### 6.7 Cambio de compañía en contrato (solo si aplica)

| Campo | Valor |
|---|---|
| `change_type` | `contract_updated` |
| `field_name` | `contract.new_company` |
| `old_value` | Compañía actual |
| `new_value` | Nueva compañía seleccionada |
| `description` | `Renovación: Compañía actualizada de "{old}" a "{new}"` |

| Campo | Valor |
|---|---|
| `change_type` | `contract_updated` |
| `field_name` | `contract.old_company` |
| `old_value` | old_company anterior |
| `new_value` | new_company anterior (que ahora pasa a ser old_company) |
| `description` | `Renovación: Compañía anterior actualizada` |

---

### 7. Registro en `tramite_renewal_history`

Dentro de la misma transacción (paso 5 de la sección 5.2), se inserta un snapshot completo:

```sql
INSERT INTO tramite_renewal_history (
  id, tramite_id, renewal_number, user_id,
  previous_activation_date, previous_renovation_date,
  new_activation_date, new_renovation_date,
  previous_status, previous_liquidez_status,
  company_changed, previous_company, new_company
) VALUES (
  :uuid,
  :tramite_id,
  :renewal_count,              -- El nuevo valor tras el incremento
  :user_id,
  :old_activation_date,        -- Fecha de activación antes de renovar
  :old_renovation_date,        -- Fecha de renovación antes de renovar
  :new_activation_date,        -- Nueva activation_date
  :new_renovation_date,        -- Nueva renovation_date
  :old_status,                 -- Estado antes de renovar (e.g. 'Activo')
  :old_liquidez_status,        -- Liquidez antes de renovar
  :company_changed,            -- 0 o 1
  :previous_company,           -- new_company del contrato antes de renovar
  :new_company                 -- Compañía seleccionada (o misma si no cambió)
);
```

Esto permite consultas directas como:

```sql
-- Historial completo de renovaciones de un trámite
SELECT rh.*, u.name as user_name
FROM tramite_renewal_history rh
LEFT JOIN user u ON rh.user_id = u.id
WHERE rh.tramite_id = ?
ORDER BY rh.renewal_number ASC;

-- Trámites con más renovaciones
SELECT t.id, t.renewal_count, t.status
FROM tramites t
WHERE t.renewal_count > 0
ORDER BY t.renewal_count DESC;

-- Renovaciones con cambio de compañía
SELECT * FROM tramite_renewal_history
WHERE company_changed = 1
ORDER BY created_at DESC;
```

---

### 8. Modificaciones al tipo TypeScript

**`src/tramites/types/tramite-changes.types.ts`**

```diff
 export type TramiteChangeType =
   | "created"
   | "status_change"
   | "field_update"
   | "client_update"
   | "signer_update"
   | "document_upload"
   | "document_delete"
   | "note_added"
   | "assignment_change"
   | "contract_created"
   | "contract_updated"
   | "contract_deleted"
   | "commission_update"
   | "date_update"
   | "provider_update"
   | "renewal_created"
-  | "renewal_updated";
+  | "renewal_updated"
+  | "renovation_completed";
```

---

### 9. Migración SQL

```sql
-- =============================================
-- MIGRACIÓN: Flujo de renovación mejorado
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

-- 3. CHECK constraint de tramite_changes
-- SQLite no soporta ALTER CHECK constraints directamente.
-- Opción recomendada: dado que Turso/LibSQL usa SQLite,
-- verificar si enforce el CHECK. Si sí:
--   a) Crear tabla temporal con el CHECK actualizado (incluyendo 'renovation_completed')
--   b) Copiar datos
--   c) DROP tabla antigua
--   d) Renombrar nueva tabla
-- Si no enforce el CHECK, solo actualizar schema.sql y el tipo TypeScript.

-- 4. Inicializar renewal_count para trámites existentes con renovaciones previas
-- (basándose en registros existentes de tramite_changes con change_type = 'renewal_created')
UPDATE tramites SET renewal_count = (
  SELECT COUNT(*) FROM tramite_changes
  WHERE tramite_changes.tramite_id = tramites.id
  AND tramite_changes.change_type IN ('renewal_created', 'renewal_updated')
) WHERE id IN (
  SELECT DISTINCT tramite_id FROM tramite_changes
  WHERE change_type IN ('renewal_created', 'renewal_updated')
);
```

---

## Archivos a modificar

| Archivo | Tipo de cambio |
|---|---|
| `src/tramites/components/RenewTramiteConfirmationDialog.tsx` | **Mayor** — Nuevo formulario con DatePickers, Switch, Select |
| `src/app/api/v2/contracts/[id]/renewal/route.ts` | **Mayor** — Nuevo body, transacción, renewal_history, registros de cambios |
| `src/tramites/types/tramite-changes.types.ts` | **Menor** — Añadir `renovation_completed` |
| `src/tramites/types/tramite.types.ts` | **Menor** — Añadir `renewal_count` a `TramiteDB` |
| `src/tramites/types/tramite-renewal-history.types.ts` | **Nuevo** — Tipo `TramiteRenewalHistory` |
| `docs/schema.sql` | **Menor** — Actualizar CHECK, nueva tabla, nueva columna |
| `src/tramites/utils/tramiteChangesHelpers.ts` | **Menor** — Añadir helper `recordRenewalCompleted()` |

## Archivos que NO se modifican

| Archivo | Razón |
|---|---|
| `UpdateTramiteStatusModal.tsx` | No se toca, solo se reutiliza su patrón de DatePicker |
| `useActiveEnergySuppliers.ts` | Se usa tal cual, sin modificaciones |
| `tramite.constants.ts` | Ya tiene `"Renovación"` en `CONTRACT_TYPES` |

---

## Flujo visual del diálogo renovado

```
┌─────────────────────────────────────────────────────┐
│  🔄 Renovar Trámite                                │
│                                                     │
│  ┌─ Información del trámite ──────────────────────┐ │
│  │  ID: #abc123          Cliente: Juan Pérez       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Fechas (editables) ──────────────────────────┐  │
│  │  Fecha de Activación        Fecha Renovación   │  │
│  │  [📅 15/03/2026    ]       [📅 15/03/2027   ]  │  │
│  │                                                │  │
│  │  Actual: 10/01/2025         Actual: 10/01/2026 │  │
│  │  Nueva:  15/03/2026         Nueva:  15/03/2027 │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ Cambio de compañía ──────────────────────────┐  │
│  │  ¿Ha habido cambio de compañía?   [  🔘  ]    │  │
│  │                                                │  │
│  │  (si activo):                                  │  │
│  │  Nueva compañía: [▼ Seleccionar compañía    ]  │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ Cambios automáticos ─────────────────────────┐  │
│  │  • Estado → Pendiente de Firma                 │  │
│  │  • Liquidez → Se reinicia                      │  │
│  │  • Tipo contrato → Renovación                  │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ☑ Notificar al usuario                             │
│                                                     │
│  [Cancelar]              [🔄 Confirmar renovación]  │
└─────────────────────────────────────────────────────┘
```

---

## Estrategia de trazabilidad: 3 niveles

La trazabilidad de renovaciones se implementa en 3 niveles complementarios:

| Nivel | Mecanismo | Propósito | Consulta típica |
|---|---|---|---|
| **Rápido** | `tramites.renewal_count` | Vista rápida: ¿se ha renovado? ¿cuántas veces? | `SELECT renewal_count FROM tramites WHERE id = ?` |
| **Dedicado** | `tramite_renewal_history` | Historial exclusivo de renovaciones con snapshot completo | `SELECT * FROM tramite_renewal_history WHERE tramite_id = ? ORDER BY renewal_number` |
| **Granular** | `tramite_changes` | Detalle campo por campo de cada renovación, integrado con el resto del histórico del trámite | `SELECT * FROM tramite_changes WHERE tramite_id = ? AND change_type = 'renovation_completed'` |

Esto permite:
- **En listados/tablas**: Mostrar un badge "Renovado ×2" usando solo `renewal_count` sin queries adicionales.
- **En detalle del trámite**: Mostrar una sección "Historial de renovaciones" alimentada por `tramite_renewal_history`.
- **En timeline completo**: Los registros de `tramite_changes` se integran con el resto del historial (cambios de estado, comisiones, documentos, etc.) para una vista cronológica unificada.
