# Plan de Optimización y Mejoras UI/UX — Importación Excel Liquidez

> **Estado**: Listo para ejecución  
> **Fecha**: Junio 2025  
> **Scope**: `src/tramites/components/liquidez/`, `src/tramites/hooks/useExcelImport.ts`, `src/app/api/v2/contracts/match-cups/route.ts`  
> **Skills aplicadas**: ui-ux-pro-max, apple-hig-designer, code-quality, vercel-react-best-practices, api-design

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Auditoría del estado actual](#2-auditoría-del-estado-actual)
3. [Plan de mejoras por prioridad](#3-plan-de-mejoras-por-prioridad)
4. [Detalles de implementación](#4-detalles-de-implementación)
5. [Checklist pre-producción](#5-checklist-pre-producción)

---

## 1. Resumen ejecutivo

La funcionalidad de importación Excel de certificación de liquidez está **funcionalmente completa** con las 10 mejoras "killer" implementadas:

| # | Mejora | Estado |
|---|--------|--------|
| 1 | Auto-detección de columna CUPS | ✅ |
| 2 | Validación CUPS (regex ES…) | ✅ |
| 3 | Detección de conflictos e warnings inteligentes | ✅ |
| 4 | Filtros por estado y liquidez con badges | ✅ |
| 5 | Actualización por tandas (batches de 50) | ✅ |
| 6 | Persistencia en sessionStorage | ✅ |
| 7 | Barra de progreso en tiempo real | ✅ |
| 8 | Resumen descargable en Excel | ✅ |
| 9 | Vista previa del archivo | ✅ |
| 10 | Multi-hoja y selector de columna | ✅ |

Este documento define las optimizaciones de **rendimiento, UI/UX, accesibilidad, calidad de código y diseño API** necesarias para alcanzar calidad de producción.

---

## 2. Auditoría del estado actual

### 2.1 Rendimiento (vercel-react-best-practices)

| ID | Hallazgo | Severidad | Archivo | Regla |
|----|----------|-----------|---------|-------|
| P1 | `xlsx` se importa estáticamente en `FileUploadStep` y `SummaryStep` (~300KB bundle) | **CRITICAL** | `FileUploadStep.tsx`, `SummaryStep.tsx`, `excel-import.ts` | `bundle-dynamic-imports` |
| P2 | `parseExcelFile()` ejecuta sincronamente en el hilo principal — bloquea UI con archivos grandes (>5000 filas) | **HIGH** | `excel-import.ts` | `rendering-usetransition-loading` |
| P3 | El `useMemo` de `filteredCups` en `SelectionStep` recalcula en cada cambio de `selectedIds` por ser un `Set` (referencia siempre nueva) | **MEDIUM** | `SelectionStep.tsx` | `rerender-derived-state` |
| P4 | La tabla de CUPS renderiza todas las filas sin virtualización — lento con >500 CUPS | **MEDIUM** | `SelectionStep.tsx` | `rendering-content-visibility` |
| P5 | `sessionStorage.setItem` se llama en cada tick del efecto cuando está en step "selection" | **LOW** | `useExcelImport.ts` | `js-cache-storage` |
| P6 | `deduplicateCups` usa `Array.includes()` para buscar duplicados — O(n²) | **LOW** | `excel-import.ts` | `js-set-map-lookups` |

### 2.2 UI/UX (ui-ux-pro-max + apple-hig-designer)

| ID | Hallazgo | Severidad | Archivo | Regla |
|----|----------|-----------|---------|-------|
| U1 | Faltan focus rings visibles en los filter badges (controles clickeables sin `focus-visible`) | **CRITICAL** | `SelectionStep.tsx` | `focus-states` |
| U2 | La zona de drop no tiene estado `focus` para navegación por teclado | **CRITICAL** | `FileUploadStep.tsx` | `keyboard-nav` |
| U3 | Los tooltips y badges no tienen `aria-label` descriptivo | **HIGH** | `SelectionStep.tsx`, `ValidationStep.tsx` | `aria-labels` |
| U4 | La barra de progreso no informa al screen reader del avance | **HIGH** | `SelectionStep.tsx` | `aria-labels` |
| U5 | Transiciones en los step indicators no respetan `prefers-reduced-motion` | **MEDIUM** | `ImportExcelLiquidezModal.tsx` | `reduced-motion` |
| U6 | El texto "Lote X de Y" durante actualización es muy escueto — falta feedback del paso actual | **MEDIUM** | `SelectionStep.tsx` | `loading-states` |
| U7 | No hay confirmación antes de ejecutar la actualización masiva (acción destructiva sin prompt) | **HIGH** | `SelectionStep.tsx` | Apple HIG: Confirmación acciones destructivas |
| U8 | El botón "Cerrar" en SummaryStep no indica que refrescará la tabla — posible confusión | **LOW** | `SummaryStep.tsx` | Apple HIG: Claridad |
| U9 | La tabla de preview en paso 1 no tiene `role="table"` ni headers accesibles (ya que son `<table>`, es correcto, pero faltan `scope="col"`) | **LOW** | `FileUploadStep.tsx` | `form-labels` |

### 2.3 API Design (api-design)

| ID | Hallazgo | Severidad | Archivo | Regla |
|----|----------|-----------|---------|-------|
| A1 | El endpoint `match-cups` no implementa rate limiting — vulnerable a abuso | **HIGH** | `match-cups/route.ts` | Seguridad API |
| A2 | El JOIN `LEFT JOIN comercializadoras com ON con.new_company = com.id OR con.new_company = com.name` puede ser ineficiente si no hay índice en `comercializadoras.name` | **MEDIUM** | `match-cups/route.ts` | Optimización queries |
| A3 | No hay logging estructurado del número de CUPS procesados ni del tiempo de respuesta | **MEDIUM** | `match-cups/route.ts` | Observabilidad |
| A4 | La respuesta del endpoint no incluye paginación ni metadata (total matched vs total requested) | **LOW** | `match-cups/route.ts` | Pagination |
| A5 | Los errores retornan `error` como string plano en vez de formato estructurado `{ code, message, details }` | **LOW** | `match-cups/route.ts` | Error handling |

### 2.4 Calidad de código (code-quality)

| ID | Hallazgo | Severidad | Archivo |
|----|----------|-----------|---------|
| C1 | `catch` vacío en `handleCopyUnmatched` — si `navigator.clipboard` falla no hay feedback | **MEDIUM** | `ValidationStep.tsx` |
| C2 | Tipo `LiquidezStatus` se castea con `as` en múltiples sitios — debería ser inferido | **LOW** | `SelectionStep.tsx`, `SummaryStep.tsx` |
| C3 | Magic number `500` (BATCH_SIZE en API), `50` (BATCH_SIZE en hook), `2` (horas para expiración sessionStorage) sin constantes nombradas | **LOW** | `match-cups/route.ts`, `useExcelImport.ts` |
| C4 | El `eslint-disable-line` en `ValidationStep.tsx` para el efecto de auto-matching podría evitarse con un ref | **LOW** | `ValidationStep.tsx` |

---

## 3. Plan de mejoras por prioridad

### Fase A — Críticas (impacto inmediato en UX y rendimiento)

| Ticket | Mejora | Archivos | Esfuerzo |
|--------|--------|----------|----------|
| A.1 | **Dynamic import de `xlsx`** — cargar solo cuando el usuario abre el modal | `ImportExcelLiquidezModal.tsx`, `excel-import.ts`, `SummaryStep.tsx` | S |
| A.2 | **Confirmación antes de actualizar** — dialog de confirmación con resumen de lo que se va a hacer | `SelectionStep.tsx` | S |
| A.3 | **Focus rings y keyboard navigation** — añadir `focus-visible:ring-2` a filter badges, dropzone con `tabIndex`, `aria-label` | `SelectionStep.tsx`, `FileUploadStep.tsx` | S |
| A.4 | **ARIA en barra de progreso** — `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` y `role="progressbar"` en la barra de progreso | `SelectionStep.tsx` | XS |

### Fase B — Altas (rendimiento con volumen)

| Ticket | Mejora | Archivos | Esfuerzo |
|--------|--------|----------|----------|
| B.1 | **Virtualización de tabla con `@tanstack/react-virtual`** — la dependencia ya está disponible vía `@tanstack/react-table`, renderizar solo filas visibles | `SelectionStep.tsx` | M |
| B.2 | **Parseo Excel en Web Worker** — mover `parseExcelFile` a un Worker para no bloquear UI con archivos >2000 filas | `excel-import.ts`, `useExcelImport.ts` | M |
| B.3 | **Debounce en sessionStorage save** — evitar writes excesivos usando `requestIdleCallback` o debounce de 1s | `useExcelImport.ts` | XS |
| B.4 | **Logging estructurado en match-cups** — loguear `{ cupsRequested, cupsMatched, duration }` | `match-cups/route.ts` | XS |

### Fase C — Medias (polish UI/UX)

| Ticket | Mejora | Archivos | Esfuerzo |
|--------|--------|----------|----------|
| C.1 | **`prefers-reduced-motion`** — desactivar transiciones de paso y animaciones cuando el usuario lo solicita | `ImportExcelLiquidezModal.tsx` | XS |
| C.2 | **Toast de éxito al cerrar** — mostrar un toast confirmando "Tabla actualizada con X trámites" cuando el modal se cierra | `ImportExcelLiquidezModal.tsx` | XS |
| C.3 | **Feedback en clipboard** — mostrar toast/inline si `navigator.clipboard.writeText` falla | `ValidationStep.tsx` | XS |
| C.4 | **Texto descriptivo en botón Cerrar** — cambiar "Cerrar" por "Cerrar y actualizar tabla" en SummaryStep tras actualizaciones | `SummaryStep.tsx` | XS |
| C.5 | **Estabilizar `filteredCups` memo** — usar referencia estable del `Set` de `selectedIds` para no invalidar el filtro innecesariamente (separar el memo de filtrado del memo de selección) | `SelectionStep.tsx` | S |

### Fase D — Bajas (mejoras técnicas menores)

| Ticket | Mejora | Archivos | Esfuerzo |
|--------|--------|----------|----------|
| D.1 | **Constantes nombradas** — extraer `API_BATCH_SIZE = 500`, `UPDATE_BATCH_SIZE = 50`, `SESSION_EXPIRY_HOURS = 2` | `match-cups/route.ts`, `useExcelImport.ts` | XS |
| D.2 | **Set en `deduplicateCups`** — cambiar `duplicates.includes()` por un `Set<string>` | `excel-import.ts` | XS |
| D.3 | **Error response format** — unificar errores del API a `{ error: { code, message } }` | `match-cups/route.ts` | S |
| D.4 | **Eliminar `eslint-disable`** — usar `useRef(false)` + `useEffect` para controlar auto-matching | `ValidationStep.tsx` | XS |
| D.5 | **Scope en headers de tabla** — añadir `scope="col"` a todos los `<th>` | Todos los step components | XS |

---

## 4. Detalles de implementación

### A.1 — Dynamic import de `xlsx`

**Problema**: `xlsx` (SheetJS) pesa ~300KB minificado. Se importa estáticamente en 3 archivos, añadiendo ese peso al bundle inicial del módulo de trámites aunque el usuario no abra el modal de importación.

**Solución**:
```tsx
// excel-import.ts
export async function parseExcelFile(file: ArrayBuffer, sheetIndex = 0): Promise<ExcelParseResult> {
  const XLSX = await import("xlsx");
  // ... rest of function
}

// SummaryStep.tsx — handleDownloadReport
const handleDownloadReport = useCallback(async () => {
  const XLSX = await import("xlsx");
  // ... rest of function
}, [summary, matchedCups]);
```

**Impacto**: Reduce el bundle del módulo de trámites en ~300KB. La carga es imperceptible (<100ms) ya que el usuario está interactuando con UI cuando ejecuta estas funciones.

**Regla**: `bundle-dynamic-imports` (vercel-react-best-practices, Priority 2 CRITICAL)

---

### A.2 — Confirmación antes de actualizar

**Problema**: El botón "Actualizar X trámites" ejecuta la operación masiva inmediatamente sin confirmación. Según Apple HIG, las acciones con impacto significativo requieren confirmación explícita.

**Solución**:
```tsx
// En SelectionStep.tsx, antes del botón de actualizar
const [showConfirm, setShowConfirm] = useState(false);

// Reemplazar onClick={onUpdateBatch} por onClick={() => setShowConfirm(true)}
// Renderizar un AlertDialog de confirmación:

<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirmar actualización</AlertDialogTitle>
      <AlertDialogDescription>
        Se va a cambiar el estado de liquidez de {selectedCount} trámite{selectedCount > 1 ? 's' : ''} a "{targetStatus}".
        {conflictWarnings.filter(w => w.severity === 'warning').length > 0 && 
          ' Hay advertencias activas que deberías revisar.'}
        Esta acción no se puede deshacer.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={onUpdateBatch}>Confirmar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Regla**: Apple HIG Principio de Claridad, `error-feedback` (ui-ux-pro-max)

---

### A.3 — Focus rings y keyboard navigation

**Problema**: Los filter badges (botones de filtro por estado/liquidez) no tienen estilos `focus-visible`, lo que los hace invisibles para usuarios de teclado. La zona de dropzone no tiene `tabIndex` explícito.

**Solución**:
```tsx
// Filter badges en SelectionStep.tsx — añadir focus-visible
className={`... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}

// Dropzone en FileUploadStep — react-dropzone ya gestiona tabIndex pero asegurar aria-label
<div {...getRootProps()} aria-label="Zona de carga de archivo Excel">
```

**Regla**: `focus-states`, `keyboard-nav` (ui-ux-pro-max, Priority 1 CRITICAL)

---

### A.4 — ARIA en barra de progreso

**Problema**: La barra de progreso no comunica su estado a tecnologías asistivas.

**Solución**:
```tsx
<Progress 
  value={updateProgress.percentage} 
  className="h-2"
  aria-label={`Progreso de actualización: lote ${updateProgress.current} de ${updateProgress.total}`}
/>
```

El componente `Progress` de Radix ya incluye `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

---

### B.1 — Virtualización de tabla

**Problema**: Con 500+ CUPS, la tabla renderiza todas las filas en el DOM, causando lag en scroll y re-renders lentos al cambiar selección.

**Solución**: Usar `@tanstack/react-virtual` (ya disponible como dependencia de `@tanstack/react-table`):

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: filteredCups.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 40, // ~40px per row
  overscan: 10,
});

// En el JSX:
<div ref={parentRef} className="max-h-72 overflow-y-auto border rounded-lg">
  <table className="w-full text-sm">
    <thead>...</thead>
    <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const m = filteredCups[virtualRow.index];
        return (
          <tr key={m.cups} style={{ 
            position: 'absolute', 
            top: 0, 
            transform: `translateY(${virtualRow.start}px)`,
            width: '100%'
          }}>
            {/* cells */}
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

**Impacto**: De renderizar 500+ nodos DOM a solo ~20-30 visibles. Mejora dramática en scroll y selección.

**Regla**: `rendering-content-visibility` (vercel-react-best-practices, Priority 6)

---

### B.2 — Parseo Excel en Web Worker

**Problema**: `parseExcelFile()` ejecuta sincronamente. Con archivos >5000 filas, bloquea el hilo principal ~500ms-2s, congelando la UI.

**Solución**: Crear un worker dedicado:

```ts
// src/tramites/workers/excel-parse.worker.ts
import * as XLSX from "xlsx";

self.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer; sheetIndex: number; columnIndex?: number }>) => {
  const { buffer, sheetIndex, columnIndex } = e.data;
  // ... parsing logic (moved from excel-import.ts)
  self.postMessage({ result });
};
```

```ts
// En useExcelImport.ts
const workerRef = useRef<Worker | null>(null);

const handleFileDrop = useCallback(async (file: File) => {
  const buffer = await file.arrayBuffer();
  const worker = new Worker(new URL('../workers/excel-parse.worker.ts', import.meta.url));
  workerRef.current = worker;
  
  worker.onmessage = (e) => {
    setParseResult(e.data.result);
    worker.terminate();
  };
  worker.postMessage({ buffer, sheetIndex: 0 });
}, []);
```

**Impacto**: UI permanece responsiva durante todo el parseo. La tabla de preview y los controles de selección se muestran sin lag.

---

### B.3 — Debounce en sessionStorage

**Problema**: El `useEffect` que guarda en `sessionStorage` se ejecuta en cada cambio de `selectedIds`, lo que ocurre en cada click de checkbox — serialize y write síncrono.

**Solución**:
```ts
// En useExcelImport.ts
const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

useEffect(() => {
  if (isRestoringRef.current || step !== "selection" || matchedCups.length === 0) return;
  
  clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = setTimeout(() => {
    const state: PersistedState = { /* ... */ };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  }, 1000); // debounce 1s
  
  return () => clearTimeout(saveTimeoutRef.current);
}, [step, fileName, matchedCups, unmatchedCups, duplicatesInExcel, selectedIds, targetStatus, batchTransitions]);
```

**Regla**: `js-cache-storage` (vercel-react-best-practices, Priority 7)

---

### C.5 — Estabilizar memo de filteredCups

**Problema**: `filteredCups` incluye un check contra `selectedIds.has()` para el cálculo de `selectedCount`, pero `selectedIds` (un `Set`) cambia de referencia en cada toggle, invalidando el memo de filtrado.

**Solución**: Separar el memo de filtrado (que depende de `searchQuery`, `statusFilter`, `liquidezFilter`) del cálculo de selección:

```tsx
// filteredCups NO depende de selectedIds — solo filtra por query y badges
const filteredCups = useMemo(() => {
  return matchedCups.filter((m) => {
    if (searchQuery) { /* ... */ }
    if (statusFilter && m.status !== statusFilter) return false;
    if (liquidezFilter) { /* ... */ }
    return true;
  });
}, [matchedCups, searchQuery, statusFilter, liquidezFilter]); // ← sin selectedIds

// selectedCount calculado aparte (barato)
const selectedCount = useMemo(
  () => filteredCups.filter((m) => selectedIds.has(m.cups)).length,
  [filteredCups, selectedIds],
);
```

**Regla**: `rerender-derived-state` (vercel-react-best-practices, Priority 5)

---

## 5. Checklist pre-producción

### Visual Quality (ui-ux-pro-max)
- [ ] Todos los iconos son de Lucide (consistencia) — ✅ verificado
- [ ] Hover states no causan layout shift — ✅ verificado (solo cambios de color/bg)
- [ ] Colores de contraste adecuados en badges y textos (4.5:1 mínimo) — ✅ los badges usan paleta Tailwind con contraste correcto
- [ ] Transiciones suaves (150-300ms) — ✅ `transition-colors` / `transition-all`
- [ ] No se usan emojis como iconos — ✅ verificado

### Interaction (ui-ux-pro-max + apple-hig-designer)
- [ ] **A.3** Focus rings en filter badges
- [ ] **A.2** Confirmación antes de actualización masiva
- [ ] `cursor-pointer` en todos los elementos interactivos — ✅ verificado (rows, badges, dropzone)
- [ ] Feedback visual en loading — ✅ Loader2 spinner + progress bar

### Accessibility (ui-ux-pro-max)
- [ ] **A.4** ARIA en barra de progreso
- [ ] **A.3** `aria-label` en dropzone
- [ ] **D.5** `scope="col"` en headers de tabla
- [ ] Color no es el único indicador — ✅ los badges tienen texto además de color

### Performance (vercel-react-best-practices)
- [ ] **A.1** Dynamic import de xlsx
- [ ] **B.1** Virtualización de tabla (si >200 CUPS esperados)
- [ ] **B.2** Worker para parseo (si >2000 filas esperadas)
- [ ] **B.3** Debounce sessionStorage
- [ ] **C.5** Estabilizar memo de filteredCups

### Code Quality (code-quality)
- [ ] **D.1** Constantes nombradas para magic numbers
- [ ] **D.2** Set en deduplicateCups
- [ ] **D.4** Eliminar eslint-disable en ValidationStep

### API (api-design)
- [ ] **B.4** Logging estructurado
- [ ] **D.3** Error response format unificado

---

## Resumen de esfuerzo

| Fase | Tickets | Esfuerzo total | Prioridad |
|------|---------|----------------|-----------|
| **A** (Críticas) | A.1, A.2, A.3, A.4 | ~S-M | 🔴 Inmediata |
| **B** (Altas) | B.1, B.2, B.3, B.4 | ~M-L | 🟠 Próximo sprint |
| **C** (Medias) | C.1, C.2, C.3, C.4, C.5 | ~S | 🟡 Backlog priorizado |
| **D** (Bajas) | D.1, D.2, D.3, D.4, D.5 | ~XS-S | 🟢 Backlog |

**Leyenda**: XS = <30min, S = 30min-1h, M = 1-3h, L = 3-6h

---

*Documento generado aplicando las skills ui-ux-pro-max (accesibilidad WCAG, patrones de interacción, checklist visual), apple-hig-designer (principios de Claridad, Deferencia, Profundidad), code-quality (correcciones, no over-engineering, constantes), vercel-react-best-practices (eliminación de waterfalls, optimización de bundle y re-renders), y api-design (formato de errores, logging, validación).*
