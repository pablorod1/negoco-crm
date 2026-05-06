# Ajustes Post-Webhook de Abarca — Análisis y Plan de Ejecución

## Contexto

Tras la implementación del webhook de Abarca y las primeras pruebas reales, se han identificado **4 problemas** que impiden una experiencia completa. Este documento analiza cada uno y propone un plan de ejecución ordenado.

---

## Problema 1: No se muestra la información del estudio de Abarca en MainView

### Situación actual

- El campo `comparativa.abarca_estudio` está disponible en `ComparativaVM` y el endpoint GET `/api/v2/comparisons/[id]` ya lo popula consultando la tabla `abarca_estudios`.
- Sin embargo, **`MainView.tsx` no renderiza ningún dato del estudio**. La información existe en el objeto pero no se pinta en la interfaz.

### Solución propuesta

Añadir una **nueva Card** en `MainView.tsx` que muestre los datos del estudio de Abarca cuando `comparativa.abarca_estudio` exista. La card se renderiza entre las cards existentes y la sección de documentos.

**Datos a mostrar:**

| Sección | Campos |
|---------|--------|
| Titular | `nombre_completo`, `dni`, `email`, `movil` |
| Suministro | `cups`, `tipo_tarifa`, `potencia_contratada`, `potencia_contratada_p2` |
| Dirección CUPS | `calle_cups`, `numero_cups`, `codpostal_cups`, `localidad_cups` |
| Comercializadoras | `empresa_cliente` (antigua) → `empresa` (nueva propuesta) |
| Extras | `iban`, `cambio_titularidad`, `tiene_placas`, `observaciones` |

**Diseño**: Card con icono `Zap` y título "Estudio Negoco Cloud IA", con layout en grid de 2-3 columnas mostrando los campos key-value, coherente con el estilo de la card "Información General" existente.

### Archivos afectados

- `src/comparativas/components/details/MainView.tsx`

---

## Problema 2: No se asignan comisiones ni compañía al completar via Abarca

### Situación actual

El webhook de Abarca actualiza la comparativa directamente a status `completed` en la línea:

```typescript
// route.ts línea ~247
await db.execute({
  sql: "UPDATE comparativas SET status = 'completed' WHERE id = ?",
  args: [comparativaId],
});
```

**Pero NO asigna:**
- `company_id` (la comercializadora ganadora)
- Comisiones (`comision_fijo`, `comision_indexado`, `comision_sales_person_fijo`, `comision_sales_person_indexado`)

En el flujo manual, esto lo hace `CompletarEstudioModal` (subir archivos + seleccionar compañía + asignar comisiones) ANTES de marcar como `completed`.

**Resultado**: Al ir a "Crear Trámite", las comisiones están en 0 y no hay compañía seleccionada.

### Opciones evaluadas

**Opción A — Abrir `CompletarEstudioModal` desde `AbarcaPanel`**
- ❌ Complicado: el modal espera upload de archivos (que ya hizo el webhook) y mezcla dos flujos distintos.
- ❌ UX confusa: el usuario acaba de usar el iframe de Abarca y se le vuelve a pedir archivos.

**Opción B — Nuevo estado intermedio + alerta en MainView** ✅ RECOMENDADA
- El webhook cambia el status a un nuevo estado `"awaiting_review"` en lugar de `"completed"`.
- En `MainView`, cuando `status === "awaiting_review"`, se muestra `CompletarEstudioModal` pero **en modo simplificado**: sin upload de archivos (ya los subió el webhook), solo pedir compañía ganadora + comisiones.
- Una vez asignadas, el modal cambia status a `completed`.

**Opción C — Mantener `completed` + bloquear "Crear Trámite" si faltan comisiones** ✅ MÁS SIMPLE
- No cambiar estados. El webhook sigue poniendo `completed`.
- En `MainView`, detectar `comparativa.abarca_estudio && (!comparativa.company_id || comisiones === 0)`.
- Mostrar un **banner de alerta** "Faltan comisiones y comercializadora" que bloquee el botón "Crear Trámite" con un mensaje explicativo.
- Mostrar `CompletarEstudioModal` en modo simplificado (sin upload de archivos) para que el admin pueda completar comisiones y compañía.
- Una vez asignadas, ya se puede crear el trámite.

### Decisión: Opción C

La Opción C es la más simple porque:
- No requiere nuevo estado (`awaiting_review`), evitando migrar badges, middleware, otros endpoints, etc.
- Reutiliza el flujo existente de `CompletarEstudioModal` con mínimas modificaciones.
- El botón "Crear Trámite" ya existe en el bloque `isStudied`, solo necesitamos condicionar su habilitación.

### Cambios necesarios

#### 2.1 Modificar `CompletarEstudioModal.tsx`

Añadir un modo `"abarca"` que:
- **Omite** la sección de subida de archivos (ya los subió el webhook).
- **Mantiene** la selección de comercializadora y asignación de comisiones.
- Se activa cuando `comparativa.abarca_estudio` existe Y `comparativa.status === "completed"`.
- Internamente solo llama al endpoint PATCH de status con `company_id` y `comissions`. No cambia el status (ya es `completed`).

**Props nuevos:**
```typescript
interface Props {
  comparativa: ComparativaVM;
  onUpdate: () => void;
  userData: User;
  mode?: "manual" | "abarca"; // nuevo
}
```

En modo `"abarca"`:
- No muestra la referencia al status `"pending"` para mostrar el componente — el guard condition cambia.
- No muestra upload de archivos.
- El botón dice "Asignar comisiones y comercializadora" en vez de "Completar estudio".
- Llama al mismo endpoint PATCH pero solo con `company_id` y `comissions`, sin cambiar status.

#### 2.2 Modificar `MainView.tsx`

En la sección de "Comparativa completada" (`isStudied`):

```
Si tiene abarca_estudio Y (no tiene company_id O comisiones === 0):
  → Mostrar alerta amarilla "El estudio de Abarca se ha recibido. Asigna la comercializadora y las comisiones para continuar."
  → Mostrar CompletarEstudioModal en modo "abarca"
  → AddTramiteDialog deshabilitado/oculto

Si tiene company_id Y comisiones > 0:
  → Mostrar AddTramiteDialog normalmente (flujo actual)
```

### Archivos afectados

- `src/comparativas/components/editComparativa/CompletarEstudioModal.tsx`
- `src/comparativas/components/details/MainView.tsx`

---

## Problema 3: Los datos del estudio de Abarca no se muestran en `ComparativaToTramiteStep`

### Situación actual

`ComparativaToTramiteStep` (paso 0 del diálogo de creación de trámite) muestra:
- Plan tarifario (selección fijo/indexado)
- Info resumida: cliente, comercial, servicio, compañía
- Documentos y notas en sección expandible

**No muestra** los datos del estudio de Abarca que ya están en `comparativa.abarca_estudio` (titular, CUPS, dirección, potencia, DNI, etc.).

### Solución propuesta

Si `comparativa.abarca_estudio` existe, añadir una **sección adicional** en `ComparativaToTramiteStep` que muestre un resumen de los datos del estudio con los campos clave:

- **Titular**: nombre, DNI, email, teléfono
- **Suministro**: CUPS, tarifa, potencia(s)
- **Dirección**: calle, localidad, CP

Esto permite al usuario ver de un vistazo lo que se va a pre-rellenar en los pasos siguientes.

### Archivos afectados

- `src/tramites/components/createTramite/forms/ComparativaToTramiteStep.tsx`

---

## Problema 4: No se auto-abre el formulario de cliente y contrato con datos pre-rellenados

### Situación actual

**SecondStepForm (paso de cliente)**:
- Al entrar muestra `SelectClient` (listado de clientes existentes + botón "Crear nuevo").
- El formulario `NewClientForm` solo se abre si el usuario hace clic en "Crear nuevo".
- `createEmptySecondForm(comparativa)` **ya pre-rellena** correctamente los campos del form. Pero el usuario debe hacer clic manualmente para verlo.
- Cuando se viene de una comparativa con `abarca_estudio`, debería abrirse directamente `NewClientForm` con los datos pre-rellenados.

**ThirdStepForm (paso de contrato)**:
- Al entrar muestra un formulario de estado/comisión + sección de contratos vacía con botón "Añadir Contrato".
- El formulario `ContractForm` solo se abre si el usuario hace clic en "Añadir Contrato".
- `createEmptyContractDB(comparativa)` **ya pre-rellena** correctamente CUPS, dirección, potencia, etc. Pero el usuario debe hacer clic manualmente.
- Cuando se viene de una comparativa con `abarca_estudio`, debería abrirse directamente `ContractForm` con los datos pre-rellenados.

### Solución propuesta

#### 4.1 SecondStepForm: Auto-abrir `NewClientForm` cuando hay datos de Abarca

Cuando `comparativa?.abarca_estudio` existe:
- Inicializar `newClientState` a `true` en vez de `false`.
- Esto abre directamente `NewClientForm` con los campos pre-rellenados por `createEmptySecondForm(comparativa)`.
- El usuario ve los datos y solo necesita completar los campos faltantes (ej: provincia).

```typescript
const [newClientState, setNewClientState] = useState<boolean>(
  !!comparativa?.abarca_estudio // auto-abrir si hay datos de Abarca
);
```

#### 4.2 ThirdStepForm: Auto-abrir `ContractForm` cuando hay datos de Abarca

Cuando `comparativa?.abarca_estudio` existe:
- Inicializar `showContractForm` a `true` en vez de `false`.
- Esto abre directamente `ContractForm` con los campos pre-rellenados por `createEmptyContractDB(comparativa)`.
- El usuario ve CUPS, potencia, dirección, etc. y solo necesita completar tipo de contrato, tarifa, provincia.

```typescript
const [showContractForm, setShowContractForm] = useState(
  !!comparativa?.abarca_estudio // auto-abrir si hay datos de Abarca
);
```

**Nota**: La pre-rellenación ya funciona correctamente en las factory functions. El único cambio es la inicialización del state booleano que controla la visibilidad del formulario.

### Archivos afectados

- `src/tramites/components/createTramite/forms/secondStepForm/SecondStepForm.tsx`
- `src/tramites/components/createTramite/forms/ThirdStepForm.tsx`

---

## Plan de Ejecución

### Fase 1: Bloqueo de "Crear Trámite" sin comisiones/compañía

**Prioridad: ALTA** — Sin esto, se crean trámites con comisiones 0.

| # | Tarea | Archivo |
|---|-------|---------|
| 1.1 | Añadir prop `mode?: "manual" \| "abarca"` a `CompletarEstudioModal` | `CompletarEstudioModal.tsx` |
| 1.2 | En modo `"abarca"`: omitir upload, solo pedir compañía + comisiones | `CompletarEstudioModal.tsx` |
| 1.3 | En modo `"abarca"`: cambiar guard de `status === "pending"` a `status === "completed"` y no cambiar el status en el PATCH | `CompletarEstudioModal.tsx` |
| 1.4 | En `MainView` dentro de `isStudied`: detectar si faltan comisiones/compañía cuando hay `abarca_estudio` | `MainView.tsx` |
| 1.5 | Si faltan: renderizar alerta + `CompletarEstudioModal` en modo `"abarca"`, ocultar `AddTramiteDialog` | `MainView.tsx` |
| 1.6 | Si no faltan: flujo normal con `AddTramiteDialog` | `MainView.tsx` |

### Fase 2: Mostrar datos del estudio en MainView

**Prioridad: MEDIA** — Informativo, no bloqueante.

| # | Tarea | Archivo |
|---|-------|---------|
| 2.1 | Crear card "Estudio Abarca" con secciones: titular, suministro, dirección, contacto | `MainView.tsx` |
| 2.2 | Solo renderizar si `comparativa.abarca_estudio` existe | `MainView.tsx` |

### Fase 3: Mostrar resumen de Abarca en ComparativaToTramiteStep

**Prioridad: MEDIA** — Mejora de UX.

| # | Tarea | Archivo |
|---|-------|---------|
| 3.1 | Añadir sección "Datos del estudio Abarca" con titular, CUPS, dirección  | `ComparativaToTramiteStep.tsx` |
| 3.2 | Solo renderizar si `comparativa.abarca_estudio` existe | `ComparativaToTramiteStep.tsx` |

### Fase 4: Auto-abrir formularios con datos pre-rellenados

**Prioridad: ALTA** — Sin esto, el usuario no ve los datos pre-rellenados.

| # | Tarea | Archivo |
|---|-------|---------|
| 4.1 | Inicializar `newClientState = true` cuando `comparativa?.abarca_estudio` existe | `SecondStepForm.tsx` |
| 4.2 | Inicializar `showContractForm = true` cuando `comparativa?.abarca_estudio` existe | `ThirdStepForm.tsx` |

---

## Resumen de archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/comparativas/components/details/MainView.tsx` | Card de estudio Abarca + lógica de bloqueo comisiones |
| `src/comparativas/components/editComparativa/CompletarEstudioModal.tsx` | Modo `"abarca"` sin upload |
| `src/tramites/components/createTramite/forms/ComparativaToTramiteStep.tsx` | Sección resumen de estudio |
| `src/tramites/components/createTramite/forms/secondStepForm/SecondStepForm.tsx` | Auto-abrir `NewClientForm` |
| `src/tramites/components/createTramite/forms/ThirdStepForm.tsx` | Auto-abrir `ContractForm` |

Total: **5 archivos**, ningún archivo nuevo.

---

## Diagrama de flujo actualizado

```
[Webhook Abarca]
  → Archivos subidos a Firebase ✅
  → abarca_estudios insertado ✅  
  → comparativa_files insertados ✅
  → Status → completed ✅
  → Comisiones y company_id → ❌ NO ASIGNADAS
                ↓
[MainView — status: completed, tiene abarca_estudio]
  → ¿Tiene company_id Y comisiones > 0?
    ├── NO  → Banner alerta + CompletarEstudioModal (modo abarca)
    │          → Admin selecciona compañía + asigna comisiones
    │          → PATCH endpoint actualiza company_id + comisiones
    │          → onUpdate() refresca vista
    │                ↓
    └── SÍ  → Card "Estudio Abarca" (datos informativos)
              + AddTramiteDialog habilitado
                    ↓
[AddTramiteDialog]
  → Paso 0: ComparativaToTramiteStep
      → Resumen con datos de Abarca (titular, CUPS, etc.)
  → Paso 2: SecondStepForm  
      → NewClientForm auto-abierto con campos pre-rellenados
  → Paso 3: ThirdStepForm
      → ContractForm auto-abierto con campos pre-rellenados
  → Paso 5: ReviewStep → Crear trámite
```
