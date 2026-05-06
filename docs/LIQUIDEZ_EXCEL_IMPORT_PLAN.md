# Plan de Implementación: Importación Excel para Liquidación Masiva

## Índice

1. [Análisis del Flujo Actual](#1-análisis-del-flujo-actual)
2. [Problemas y Fricción del Flujo Actual](#2-problemas-y-fricción-del-flujo-actual)
3. [Diseño del Nuevo Flujo](#3-diseño-del-nuevo-flujo)
4. [Arquitectura Técnica](#4-arquitectura-técnica)
5. [Plan de Implementación Detallado](#5-plan-de-implementación-detallado)
6. [Mejoras Killer](#6-mejoras-killer)
7. [Estructura de Archivos](#7-estructura-de-archivos)
8. [Especificación de la API](#8-especificación-de-la-api)
9. [Plan de Testing](#9-plan-de-testing)
10. [Estimación de Complejidad](#10-estimación-de-complejidad)

---

## 1. Análisis del Flujo Actual

### 1.1 Cadena de Componentes

```
Table.tsx
  └─ TramitesHeader (TableHeader.tsx)
       └─ ActionButtons.tsx
            └─ UpdateMultipleTramitesModal.tsx  (solo visible en isLiquidezTable)
```

### 1.2 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│ useTramitesData()                                               │
│   → GET /api/v2/contracts?statusFilter=["Activo","Baja"]        │
│   → Retorna TramiteRow[] con CUPS[], status, liquidez_status    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ useTableConfig()                                                │
│   → useReactTable con row selection habilitado                  │
│   → El usuario selecciona filas manualmente                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ UpdateMultipleTramitesModal                                      │
│   → Lee table.getSelectedRowModel().flatRows                    │
│   → Muestra mini-tabla con ID, Estado, Estado Liquidez          │
│   → SelectComponent para elegir nuevo estado liquidez           │
│   → POST /api/v2/contracts/multiple { ids, status }             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 API de Actualización Masiva

**Endpoint**: `POST /api/v2/contracts/multiple`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ids` | `string[]` | IDs de tramites (no CUPS) |
| `status` | `LiquidezStatus` | Nuevo estado de liquidez |

**Lógica de negocio automática**:
- Si `status = "Cobrado por Comercializadora"` → establece `collection_date = NOW`
- Si `status = "Pagado al Comercial"` → establece `payment_date = NOW`

### 1.4 Modelo de Datos Relevante

```
tramites (1) ←──── (N) contracts
  ├── id (PK)              ├── id (PK)
  ├── status               ├── tramite_id (FK)
  ├── liquidez_status      ├── CUPS (código único)
  ├── collection_date      ├── new_company / new_company_id
  ├── payment_date         ├── old_company
  └── ...                  └── ...
```

**Punto clave**: Un trámite puede tener múltiples contratos (CUPS). El `liquidez_status` vive en la tabla `tramites`, NO en `contracts`. Esto significa que al actualizar por CUPS, se actualiza el trámite completo.

### 1.5 Dependencias ya Instaladas

| Paquete | Versión | Uso |
|---------|---------|-----|
| `xlsx` | 0.18.5 | Lectura/escritura de archivos Excel |
| `react-dropzone` | 14.3.8 | Drag & drop de archivos |
| `@tanstack/react-table` | 8.21.3 | Tablas con selección de filas |
| `zod` | 3.24.2 | Validación de datos |

---

## 2. Problemas y Fricción del Flujo Actual

### 2.1 Proceso Manual Actual (Caso Real)

```
Recibe Excel con 150 CUPS certificados por Iberdrola
  ↓
Filtra tabla por compañía "Iberdrola" (~500 trámites)
  ↓
Abre el Excel en paralelo
  ↓
Busca CUPS 1 en la tabla del CRM → selecciona
Busca CUPS 2 en la tabla del CRM → selecciona
... (×150 veces)
  ↓
Selecciona estado "Cobrado por Comercializadora"
  ↓
Actualiza
```

### 2.2 Puntos de Dolor

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **Selección manual uno a uno** | ~2-3 min por CUPS × 150 = **5-7 horas** |
| 2 | **Riesgo de error humano** | CUPS mal seleccionado, omitido o duplicado |
| 3 | **Sin validación cruzada** | No se verifica si el CUPS del Excel existe en el CRM |
| 4 | **Sin auditoría** | No queda registro de qué Excel generó qué cambios |
| 5 | **Proceso no pausable** | Si se interrumpe, hay que empezar de nuevo |
| 6 | **No distingue estados mixtos** | Todos los CUPS de un Excel pueden tener distinto estado destino |
| 7 | **Sin confirmación visual** | El usuario no ve claramente qué va a cambiar antes de confirmar |

---

## 3. Diseño del Nuevo Flujo

### 3.1 Flujo Propuesto (Step Wizard)

```
┌──────────────────────────────────────────────────────────────┐
│                    STEP 1: IMPORTAR EXCEL                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │         📁 Arrastra tu archivo Excel aquí            │    │
│  │            o haz clic para seleccionar               │    │
│  │                                                      │    │
│  │         Formatos: .xlsx, .xls, .csv                  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Mapeo de columnas:                                          │
│  ┌──────────────────┬───────────────────────┐               │
│  │ Columna Excel    │ Campo CRM             │               │
│  ├──────────────────┼───────────────────────┤               │
│  │ "CUPS"           │ CUPS (auto-detectado) │               │
│  └──────────────────┴───────────────────────┘               │
│                                                              │
│                                      [Siguiente →]          │
└──────────────────────────────────────────────────────────────┘

                            ↓

┌──────────────────────────────────────────────────────────────┐
│                 STEP 2: VALIDACIÓN Y MATCHING                │
│                                                              │
│  Resumen de importación:                                     │
│  ┌────────────────────────────────────────┐                  │
│  │ ✅ 142 CUPS encontrados en el CRM      │                  │
│  │ ⚠️  5 CUPS no encontrados              │                  │
│  │ ❌ 3 CUPS duplicados en el Excel       │                  │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  [Ver CUPS no encontrados ▾]                                 │
│  ES0021...4567XQ, ES0031...8901AB, ...                       │
│                                                              │
│                             [← Anterior] [Siguiente →]      │
└──────────────────────────────────────────────────────────────┘

                            ↓

┌──────────────────────────────────────────────────────────────┐
│               STEP 3: SELECCIÓN Y ACTUALIZACIÓN              │
│                                                              │
│  Filtros:                                                    │
│  [Estado ▾] [Estado Liquidez ▾] [Compañía ▾] [Buscar CUPS]  │
│                                                              │
│  Estado Liquidez destino: [Cobrado por Comercializadora ▾]   │
│                                                              │
│  ┌─────┬──────────────────┬─────────┬──────────────────┐     │
│  │ ☑   │ CUPS             │ Estado  │ Estado Liquidez   │     │
│  ├─────┼──────────────────┼─────────┼──────────────────┤     │
│  │ ☑   │ ES0021...4567XQ  │ Activo  │ Pendiente Cobro  │     │
│  │ ☑   │ ES0021...8901AB  │ Activo  │ Pendiente Cobro  │     │
│  │ ☐   │ ES0021...2345CD  │ Activo  │ Cobrado x Comerc │     │
│  │ ☑   │ ES0021...6789EF  │ Baja    │ Pend. Descontar  │     │
│  └─────┴──────────────────┴─────────┴──────────────────┘     │
│                                                              │
│  142 CUPS | 130 seleccionados                                │
│                                                              │
│  [Seleccionar todos filtrados] [Deseleccionar todos]         │
│                                                              │
│                  [← Anterior] [Actualizar 130 trámites →]    │
└──────────────────────────────────────────────────────────────┘

                            ↓

┌──────────────────────────────────────────────────────────────┐
│                     STEP 4: RESUMEN FINAL                    │
│                                                              │
│  ✅ Actualización completada                                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ Transiciones realizadas:                           │      │
│  │                                                    │      │
│  │ Pendiente de Cobro → Cobrado por Comerc.   120     │      │
│  │ Adelantado → Cobrado por Comerc.            10     │      │
│  │                                            ────    │      │
│  │ Total actualizados:                         130    │      │
│  │                                                    │      │
│  │ ⚠️ No actualizados (ya en estado destino):   12    │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  [Descargar informe ↓]              [Cerrar]                 │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Flujo Alternativo: Selección Manual Preservada

El botón actual de selección manual de filas se mantiene como está. El nuevo flujo de importación por Excel se activa mediante un nuevo botón (icono de importar/upload) que abre un modal independiente con el wizard por steps.

---

## 4. Arquitectura Técnica

### 4.1 Diagrama de Componentes

```
ActionButtons.tsx
  ├── UpdateMultipleTramitesModal.tsx  (existente, sin cambios)
  └── ImportExcelLiquidezModal.tsx     (NUEVO - punto de entrada)
        ├── Step1_FileUpload.tsx        (drag & drop + mapeo columnas)
        ├── Step2_Validation.tsx        (matching CUPS + resumen)
        ├── Step3_Selection.tsx         (tabla filtrable + selección)
        └── Step4_Summary.tsx           (resumen de cambios)

hooks/
  └── useExcelImport.ts                (NUEVO - lógica de importación)

utils/
  └── excel-import.ts                  (NUEVO - parseo Excel + matching)
```

### 4.2 Diagrama de Secuencia

```
Usuario          Frontend                    API                     DB
  │                  │                        │                       │
  │ Sube Excel       │                        │                       │
  ├─────────────────►│                        │                       │
  │                  │ Parse Excel (client)   │                       │
  │                  │ Extrae CUPS[]          │                       │
  │                  │                        │                       │
  │                  │ POST /api/v2/contracts/match-cups              │
  │                  ├───────────────────────►│                       │
  │                  │                        │ SELECT WHERE CUPS IN  │
  │                  │                        ├──────────────────────►│
  │                  │                        │◄──────────────────────┤
  │                  │◄───────────────────────┤                       │
  │                  │                        │                       │
  │ Ve resultados    │                        │                       │
  │◄─────────────────┤                        │                       │
  │                  │                        │                       │
  │ Selecciona CUPS  │                        │                       │
  │ + nuevo estado   │                        │                       │
  ├─────────────────►│                        │                       │
  │                  │ POST /api/v2/contracts/multiple                │
  │                  ├───────────────────────►│                       │
  │                  │                        │ UPDATE tramites       │
  │                  │                        ├──────────────────────►│
  │                  │                        │◄──────────────────────┤
  │                  │◄───────────────────────┤                       │
  │                  │                        │                       │
  │ Ve resumen       │                        │                       │
  │◄─────────────────┤                        │                       │
```

### 4.3 Tipos Nuevos

```typescript
// src/tramites/types/excel-import.types.ts

/** CUPS extraído del Excel del usuario */
interface ImportedCUPS {
  cups: string;
  rowIndex: number;        // Fila original en el Excel (para trazabilidad)
  extraData?: Record<string, string>;  // Columnas extra del Excel
}

/** Resultado del matching de un CUPS contra la base de datos */
interface MatchedCUPS {
  cups: string;
  tramiteId: string;
  status: Status;
  liquidezStatus: LiquidezStatus;
  clientName: string;
  salesName: string;
  newCompany: string;
  activationDate: string;
  selected: boolean;       // Para la selección en Step 3
}

/** CUPS que no se encontró en la base de datos */
interface UnmatchedCUPS {
  cups: string;
  rowIndex: number;
  reason: 'not_found' | 'duplicate_in_excel' | 'inactive_tramite';
}

/** Resultado de la validación de importación */
interface ImportValidationResult {
  matched: MatchedCUPS[];
  unmatched: UnmatchedCUPS[];
  duplicatesInExcel: string[];
  totalInExcel: number;
}

/** Registro de una transición de estado para el resumen */
interface StatusTransition {
  fromStatus: LiquidezStatus;
  toStatus: LiquidezStatus;
  count: number;
  cups: string[];
}

/** Resumen final de actualizaciones */
interface UpdateSummary {
  transitions: StatusTransition[];
  totalUpdated: number;
  totalSkipped: number;      // Ya estaban en el estado destino
  totalFailed: number;
  skippedCups: string[];
  failedCups: string[];
  timestamp: Date;
}

/** Step del wizard */
type WizardStep = 'upload' | 'validation' | 'selection' | 'summary';
```

---

## 5. Plan de Implementación Detallado

### Fase 1: Nuevo Endpoint de Matching de CUPS

**Archivo**: `src/app/api/v2/contracts/match-cups/route.ts`

**Responsabilidad**: Recibir una lista de CUPS, buscar en la BD qué trámites tienen esos CUPS y devolver la información enriquecida.

```typescript
// POST /api/v2/contracts/match-cups
// Body: { cups: string[] }
// Response: {
//   success: boolean,
//   matched: Array<{
//     cups: string,
//     tramiteId: string,
//     status: string,
//     liquidezStatus: string,
//     clientName: string,
//     salesName: string,
//     newCompany: string,
//     activationDate: string
//   }>,
//   unmatched: string[]
// }
```

**Query SQL**:
```sql
SELECT
  c.CUPS,
  t.id AS tramite_id,
  t.status,
  t.liquidez_status,
  t.activation_date,
  t.sales_name,
  cl.name || ' ' || cl.last_name AS client_name,
  s.name AS new_company
FROM contracts c
JOIN tramites t ON c.tramite_id = t.id
JOIN clients cl ON t.client_id = cl.id
LEFT JOIN suppliers s ON c.new_company_id = s.id
WHERE c.CUPS IN (?, ?, ?, ...)
  AND t.status IN ('Activo', 'Baja')
ORDER BY c.CUPS
```

### Fase 2: Utilidad de Parseo de Excel

**Archivo**: `src/tramites/utils/excel-import.ts`

- Parsear archivo Excel/CSV usando la librería `xlsx` ya instalada
- Auto-detectar la columna que contiene CUPS (buscar patrones `ES\d{16}\w{2}` o headers como "CUPS", "Código CUPS", "CUP")
- Validar formato de CUPS (20-22 caracteres, empieza por ES)
- Limpiar datos: trim, eliminar espacios, normalizar mayúsculas
- Deduplicar CUPS dentro del mismo Excel
- Retornar `ImportedCUPS[]` + metadatos

```typescript
// Detección automática de columna CUPS
function detectCupsColumn(headers: string[], firstRows: string[][]): number {
  // 1. Buscar por nombre de header
  const cupsHeaderIndex = headers.findIndex(h =>
    /^cups$/i.test(h.trim()) || /código.*cups/i.test(h.trim())
  );
  if (cupsHeaderIndex !== -1) return cupsHeaderIndex;

  // 2. Buscar por patrón en datos
  for (let col = 0; col < headers.length; col++) {
    const matchCount = firstRows.filter(row =>
      /^ES\d{16}\w{2}$/.test(row[col]?.trim() || '')
    ).length;
    if (matchCount > firstRows.length * 0.5) return col;
  }

  return -1; // No detectada
}
```

### Fase 3: Componente Modal con Wizard

**Archivo**: `src/tramites/components/liquidez/ImportExcelLiquidezModal.tsx`

Modal con un wizard de 4 pasos que gestiona todo el flujo. Cada step es un componente independiente.

#### Step 1 — File Upload

- Reutiliza el patrón de `useDropzone` ya presente en el proyecto
- Acepta `.xlsx`, `.xls`, `.csv`
- Parseo 100% client-side (sin enviar el archivo al servidor)
- Auto-detección de la columna CUPS con indicador visual
- Si no se detecta automáticamente, dropdown para seleccionar columna manualmente
- Preview de las primeras 5 filas del Excel

#### Step 2 — Validación y Matching

- Llama al endpoint `POST /api/v2/contracts/match-cups`
- Muestra resumen visual con contadores (encontrados, no encontrados, duplicados)
- Sección expandible para ver CUPS no encontrados (copiar al portapapeles)
- Warning si hay CUPS con trámites en estado que no debería cambiar

#### Step 3 — Selección y Actualización por Tandas

- Tabla completa con todos los CUPS encontrados
- Filtros dentro del modal:
  - **Estado** (Activo / Baja)
  - **Estado Liquidez** (todos los estados actuales)
  - **Compañía** (new_company)
  - **Buscar CUPS** (texto libre)
- Checkbox por fila + "Seleccionar todos los filtrados"
- Selector de estado liquidez destino
- Botón "Actualizar X trámites" que ejecuta la actualización por tanda
- Al actualizar una tanda, la tabla se refresca:
  - Los CUPS actualizados muestran el nuevo estado
  - Se acumulan las transiciones para el resumen final
  - El usuario puede aplicar nuevos filtros y actualizar otra tanda

#### Step 4 — Resumen Final

- Tabla de transiciones: `Estado anterior → Estado nuevo | Cantidad`
- Total de CUPS actualizados vs total en el Excel
- CUPS que se saltaron (ya estaban en el estado destino)
- Botón "Descargar informe" (genera Excel con detalle de cada cambio)
- Al cerrar: refresca la tabla principal (`refreshTramites()`)

### Fase 4: Integración en ActionButtons

Añadir el nuevo botón de importación en `ActionButtons.tsx`, visible solo cuando `isLiquidezTable = true`, al lado del botón existente de `UpdateMultipleTramitesModal`.

---

## 6. Mejoras Killer

### 6.1 Auto-Detección Inteligente de Columna CUPS

El parser analiza tanto los headers como el contenido de las celdas para identificar automáticamente la columna de CUPS, sin requerir intervención del usuario en la mayoría de casos. Soporta variantes comunes de nombre ("CUPS", "CUP", "Código CUPS", "CUPS_SUMINISTRO", etc.).

### 6.2 Actualización por Tandas con Historial de Sesión

En el Step 3, el usuario puede actualizar por tandas (ej: primero los "Pendiente de Cobro" → "Cobrado", luego los "Adelantado" → "Cobrado"). Cada tanda se registra internamente, y al final se muestra el resumen acumulado de todas las tandas.

```
Tanda 1: Filtrar "Pendiente de Cobro" → Actualizar a "Cobrado por Comerc." (120 CUPS)
Tanda 2: Filtrar "Adelantado" → Actualizar a "Cobrado por Comerc." (10 CUPS)
Tanda 3: Filtrar estado "Baja" → Actualizar a "Descontado" (5 CUPS)
```

### 6.3 Detección de Conflictos y Warnings Inteligentes

Antes de actualizar, el sistema detecta y muestra warnings:
- **CUPS con estado incoherente**: Ej. intentar marcar como "Cobrado por Comerc." un trámite en estado "Baja" (debería ser "Descontado")
- **CUPS ya en estado destino**: Se muestran aparte para no procesarlos innecesariamente
- **CUPS con fecha de cobro/pago ya establecida**: Aviso de que se sobrescribirá

### 6.4 Resumen Exportable

Al finalizar, el usuario puede descargar un Excel con:
- Columna A: CUPS
- Columna B: Cliente
- Columna C: Compañía
- Columna D: Estado anterior
- Columna E: Estado nuevo
- Columna F: Fecha de actualización
- Columna G: Resultado (Actualizado / Omitido / Error)

Reutiliza la librería `xlsx` ya instalada para generar el archivo.

### 6.5 Drag & Drop con Preview Visual

El componente de upload muestra:
- Nombre del archivo + tamaño
- Número de filas detectadas
- Preview de las primeras 5 filas con la columna CUPS resaltada
- Botón para cambiar la columna detectada si es incorrecta

### 6.6 Persistencia de Progreso en sessionStorage

Si el usuario cierra el modal accidentalmente durante el proceso (Step 3), al reabrirlo se ofrece la opción de "Continuar donde lo dejaste" con los CUPS ya importados y las tandas ya ejecutadas.

### 6.7 Indicador de Progreso en Tiempo Real

Durante la actualización masiva, si hay más de 50 CUPS, se muestra una barra de progreso con:
- Porcentaje completado
- CUPS procesados / total
- Tiempo estimado restante

Para esto, se dividen las actualizaciones en lotes de 50 IDs y se envían secuencialmente (el endpoint actual ya soporta arrays, pero lotes grandes pueden fallar por timeout).

### 6.8 Filtro Rápido por Estado Liquidez con Badges Visuales

En el Step 3, los filtros de estado liquidez se muestran como badges clickeables coloreados (reutilizando `getStatusBadge`) en lugar de un select, para que el usuario haga clic rápido y vea cuántos CUPS tiene en cada estado.

```
[Pendiente de Cobro (85)] [Cobrado por Comerc. (42)] [Adelantado (15)]
```

### 6.9 Validación de Formato de CUPS

Validación robusta del formato de CUPS español:
- Longitud correcta (20-22 caracteres)
- Prefijo ES
- Patrón numérico correcto
- Eliminación automática de espacios, guiones y caracteres no válidos
- Feedback visual por cada CUPS con formato inválido

### 6.10 Soporte Multi-Hoja Excel

Si el Excel tiene múltiples hojas, se muestra un selector de hoja antes del mapeo de columnas. Muchas certificaciones de compañías usan hojas diferentes para diferentes productos (luz vs gas).

---

## 7. Estructura de Archivos

```
src/tramites/
├── components/
│   └── liquidez/
│       ├── UpdateMultipleTramitesModal.tsx          # Sin cambios
│       ├── ImportExcelLiquidezModal.tsx             # NUEVO: Modal principal (wizard)
│       └── import-steps/
│           ├── FileUploadStep.tsx                   # NUEVO: Step 1 - Upload
│           ├── ValidationStep.tsx                   # NUEVO: Step 2 - Matching
│           ├── SelectionStep.tsx                    # NUEVO: Step 3 - Tabla + filtros
│           └── SummaryStep.tsx                      # NUEVO: Step 4 - Resumen
├── hooks/
│   └── useExcelImport.ts                           # NUEVO: Hook principal del wizard
├── utils/
│   └── excel-import.ts                             # NUEVO: Parseo + matching client-side
├── types/
│   └── excel-import.types.ts                       # NUEVO: Tipos del flujo
└── constants/
    └── tramite.constants.ts                        # Existente (aprovechar LIQUIDEZ_STATUS)

src/app/api/v2/contracts/
└── match-cups/
    └── route.ts                                    # NUEVO: Endpoint de matching

src/tramites/components/table/components/
└── ActionButtons.tsx                               # MODIFICAR: Añadir botón de importar
```

---

## 8. Especificación de la API

### 8.1 POST /api/v2/contracts/match-cups

**Request**:
```json
{
  "cups": [
    "ES0021000000000001XQ",
    "ES0031000000000002AB",
    "ES0021000000000003CD"
  ]
}
```

**Response (200)**:
```json
{
  "success": true,
  "matched": [
    {
      "cups": "ES0021000000000001XQ",
      "tramiteId": "TRM-a1b2c3d4-...",
      "status": "Activo",
      "liquidezStatus": "Pendiente de Cobro",
      "clientName": "Juan García López",
      "salesName": "María Admin",
      "newCompany": "Iberdrola",
      "activationDate": "2025-06-15T00:00:00.000Z"
    }
  ],
  "unmatched": [
    "ES0031000000000002AB"
  ]
}
```

**Validación (Zod)**:
```typescript
const MatchCupsSchema = z.object({
  cups: z.array(z.string().min(16).max(25)).min(1).max(5000),
});
```

### 8.2 POST /api/v2/contracts/multiple (Existente — sin cambios)

Se reutiliza tal cual. El frontend identifica los `tramiteId` correspondientes a los CUPS seleccionados y los envía como `ids`.

---

## 9. Plan de Testing

### 9.1 Casos de Test del Parseo Excel

| # | Caso | Input | Expected |
|---|------|-------|----------|
| 1 | Excel con header "CUPS" | `.xlsx` estándar | Auto-detecta columna |
| 2 | Excel sin header claro | Columna con datos tipo CUPS | Auto-detecta por patrón |
| 3 | Excel con CUPS duplicados | 3 CUPS iguales | 1 matched + 2 duplicados |
| 4 | CSV delimitado por `;` | `.csv` europeo | Parseo correcto |
| 5 | CUPS con espacios | `"ES0021 0000 0000"` | Limpieza automática |
| 6 | Excel vacío | 0 filas de datos | Error descriptivo |
| 7 | Archivo no Excel | `.pdf` | Rechazo con mensaje |
| 8 | Excel con múltiples hojas | 3 hojas | Selector de hoja |
| 9 | Excel grande (5000+ filas) | `.xlsx` grande | Procesamiento correcto |
| 10 | CUPS con formato inválido | `"INVALID123"` | Se marca como inválido |

### 9.2 Casos de Test del Matching API

| # | Caso | Expected |
|---|------|----------|
| 1 | Todos los CUPS encontrados | 100% matched |
| 2 | Ningún CUPS encontrado | 100% unmatched |
| 3 | Mix de encontrados y no | Separación correcta |
| 4 | CUPS de trámite en estado "Borrador" | No incluido (solo Activo/Baja) |
| 5 | CUPS con múltiples trámites | Se retorna el más reciente (Activo) |
| 6 | Request vacío | Error 400 |
| 7 | Request con >5000 CUPS | Error 400 (límite) |

### 9.3 Casos de Test de Actualización por Tandas

| # | Caso | Expected |
|---|------|----------|
| 1 | Tanda simple (todos mismo estado) | Actualización exitosa |
| 2 | Múltiples tandas secuenciales | Acumulación correcta en resumen |
| 3 | CUPS ya en estado destino | Se omiten con aviso |
| 4 | Error de red durante actualización | Rollback visual + retry |
| 5 | Cierre accidental del modal | Se puede retomar |

---

## 10. Estimación de Complejidad

### Desglose por Componente

| Componente | Complejidad | Archivos Nuevos | Archivos Modificados |
|------------|-------------|------------------|---------------------|
| Tipos TypeScript | Baja | 1 | 0 |
| Utilidad parseo Excel | Media | 1 | 0 |
| Endpoint match-cups | Media | 1 | 0 |
| Hook useExcelImport | Alta | 1 | 0 |
| Step 1: FileUpload | Media | 1 | 0 |
| Step 2: Validation | Baja | 1 | 0 |
| Step 3: Selection | Alta | 1 | 0 |
| Step 4: Summary | Media | 1 | 0 |
| Modal principal (wizard) | Media | 1 | 0 |
| Integración ActionButtons | Baja | 0 | 1 |
| **Total** | | **9** | **1** |

### Orden de Implementación Recomendado

```
1. excel-import.types.ts         → Tipos base
2. excel-import.ts               → Utilidad de parseo (testeable aisladamente)
3. match-cups/route.ts           → Endpoint API (testeable con curl/Postman)
4. useExcelImport.ts             → Hook con state machine del wizard
5. FileUploadStep.tsx            → UI Step 1
6. ValidationStep.tsx            → UI Step 2
7. SelectionStep.tsx             → UI Step 3 (más complejo)
8. SummaryStep.tsx               → UI Step 4
9. ImportExcelLiquidezModal.tsx  → Orquestador del wizard
10. ActionButtons.tsx            → Integración final
```

### Dependencias entre Fases

```
Tipos ──────────────────────────┐
                                ▼
Parseo Excel ──► Hook ──► Steps UI ──► Modal ──► ActionButtons
                  ▲
API match-cups ───┘
```

---

## Apéndice A: Consideraciones de UX

1. **El Excel NO se sube al servidor**: Todo el parseo ocurre en el navegador. Solo se envían los CUPS al endpoint para el matching. Esto es más rápido, más seguro y no requiere gestión de archivos temporales.

2. **La tabla del Step 3 mantiene el patrón visual del CRM**: Usa los mismos badges de estado (`getStatusBadge`), mismos colores y misma tipografía que la tabla principal de liquidez.

3. **El modal es de tamaño `max-w-4xl`** para dar espacio a la tabla de CUPS con todos sus filtros.

4. **Las tandas son opcionales**: Si todos los CUPS van al mismo estado, el usuario selecciona todos y actualiza en una sola operación, como antes pero sin necesidad de buscar uno a uno.

5. **Keyboard shortcuts**: `Ctrl+A` para seleccionar todos, `Enter` para confirmar.

## Apéndice B: Formato de CUPS Español

```
ES 0021 0000 0000 0000 01 XQ
│  │    │    │    │    │  │
│  │    │    │    │    │  └── Checksum (2 letras)
│  │    │    │    │    └── Punto de suministro (2 dígitos)
│  │    │    │    └── Número de contrato (4 dígitos)
│  │    │    └── Referencia distribuidora (4 dígitos)
│  │    └── Zona (4 dígitos)
│  └── Código distribuidora (4 dígitos)
└── País (ES)

Longitud: 20-22 caracteres
Regex: /^ES\d{16}[A-Z]{2}\d{0,2}$/
```

## Apéndice C: Compatibilidad hacia Atrás

- El componente `UpdateMultipleTramitesModal` existente **no se modifica**. Sigue funcionando para selección manual de filas.
- El nuevo `ImportExcelLiquidezModal` es un componente completamente independiente.
- Ambos usan el mismo endpoint `POST /api/v2/contracts/multiple` para la actualización.
- El usuario puede elegir el método que prefiera según el caso de uso.
