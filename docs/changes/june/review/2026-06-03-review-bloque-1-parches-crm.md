# Review Bloque 1 - Parches CRM

Fecha de revisión: 2026-06-03

Plan revisado: `docs/changes/june/2026-06-02-bloque-1-parches-crm.md`

## Addendum 2026-06-04

Product/technical decisions after the initial review:

- Tooling is pnpm-only; Bun findings are obsolete and should be translated to pnpm/Vitest verification.
- `Rechazar Cliente` is intentionally available to comerciales.
- Deprecated POST legacy paths are not maintained and should not drive fix work.
- `Fecha de Baja` belongs in Liquidez table and trámite timeline, not in the main status panel.
- The implemented commission/default-notes model (`user_company_commissions`, `user_default_notes`) is accepted as correct.

Estado global: **implementación parcial, no lista para considerar el bloque cerrado sin correcciones**.

La mayor parte de la funcionalidad visible está presente, pero hay riesgos críticos de autorización, divergencias con la especificación original, migraciones no re-ejecutables y una baseline de verificación rota por configuración de tests/lint. Con entorno manual, la suite actual pasa, pero la verificación estándar del plan no pasa tal como está configurado el repositorio.

## Resumen Ejecutivo

| Área | Estado | Riesgo principal |
|---|---:|---|
| Infraestructura de tests DOM | Parcial | `bun test` falla sin preload porque faltan `bunfig.toml` y `test/setup-dom.ts`. |
| Estado `Rechazado Cliente` | Cumplido | Badge/tipos/constantes presentes. |
| Acción `Rechazar Cliente` | Parcial | El botón queda visible para comerciales y el backend permite ese cambio si tienen acceso a la comparativa. |
| Flags permanencia/renovación | Parcial | API/UI/tipos presentes, pero migración 005 no es idempotente. |
| Dashboard `Métricas` | Parcial | Gating cliente presente, pero API de métricas permite usuarios no gerencia. |
| KPI API y vista | Parcial | Endpoint existe, pero SQL depende de tabla sin migración numerada y los filtros no son homogéneos. |
| Filtros include/exclude | Mayormente cumplido | GET principal funciona; falta cobertura y POST legacy de comparativas pierde flags. |
| Fecha de Baja | Parcial/incumplido en flujo real | Solo se muestra en `mode="full"`; la vista de detalle usa `mode="actions"`. |
| Editor de firmante | Parcial con riesgo crítico | PATCH autentica pero no valida acceso fino; GET/POST no autentican y exponen PII. |
| Config usuario comisión/notas | Desviado | Se implementó un modelo alternativo por comercializadora/notas segmentadas, no `commission_pct/default_notes`; no se auto-aplican notas al crear trámite. |

## Verificación Ejecutada

| Comando | Resultado | Observación |
|---|---:|---|
| `git status --short` | OK | Worktree limpio antes de crear este informe. |
| `bun test` | FAIL | 28 tests pasan, 2 fallan por `ReferenceError: document is not defined`. |
| `bun test "src/app/api/v2/users/[id]/config/route.test.js" "src/app/api/v2/comparisons/[id]/flags/route.test.js" "src/app/api/v2/analytics/metrics/route.test.js" "src/app/api/v2/clients/[id]/signature/route.test.js"` | OK | 18 tests API pasan. |
| `NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_URL=http://localhost:3000 bun test --preload @happy-dom/global-registrator/register` | OK | 30 tests pasan con entorno DOM/auth manual. |
| `npx tsc --noEmit` | OK | Sin errores de TypeScript. |
| `npm run lint` | FAIL | `next lint` falla: `Invalid project directory provided, no such directory: .../lint`. |
| `npx eslint .` | FAIL | ESLint 10 falla con `TypeError: Converting circular structure to JSON` al resolver `next/core-web-vitals`. |

Conclusión de verificación: la lógica cubierta por tests pasa si se configura manualmente DOM y URLs de Better Auth, pero la baseline del plan (`bun test && npx tsc --noEmit && npm run lint`) **no pasa** en el repositorio actual.

## Cobertura Por Tarea

| Tarea | Requisito | Estado | Evidencia |
|---:|---|---:|---|
| 0 | Happy DOM + Testing Library + Bun preload | Parcial | Dependencias presentes en `package.json:88-104`, pero no existen `bunfig.toml`, `test/setup-dom.ts` ni smoke test. |
| 1 | Estado `rechazado_cliente` | Cumplido | `src/comparativas/types/comparativa.types.ts:5-11`, `src/core/hooks/use-status-badge.tsx:10-17`. |
| 2 | Acción `Rechazar Cliente` en comparativa completada | Parcial | Handler existe en `src/comparativas/components/details/MainView.tsx:170-207`, botón en `336-355`, pero visible para comerciales. |
| 3 | Flags permanencia/renovación | Parcial | API en `src/app/api/v2/comparisons/[id]/flags/route.ts:11-61`, toggles en `MainView.tsx:463-509`, migración no idempotente. |
| 4 | Vista `Métricas` gerencia-only | Parcial | Toggle oculta por `isDireccion` en `src/dashboard/components/ViewToggle.tsx:26-34`, pero API no aplica 403. |
| 5 | KPI API + MetricsView | Parcial | API existe en `src/app/api/v2/analytics/metrics/route.ts:219-462`; `MetricsView` compone tarjetas en `src/dashboard/components/charts/MetricsView.tsx:14-39`. |
| 6 | Include/exclude compañía/comercial | Mayormente cumplido | Estado en `src/core/hooks/use-table-filters.ts:65-74`, GET comparativas en `src/app/api/v2/comparisons/route.ts:299-310` y `438-459`, contratos en `src/app/api/v2/contracts/route.ts:973-974` y `1047-1119`. |
| 7 | Fecha de Baja visible | Parcial/incumplido | Se renderiza en `TramiteStatusSection.tsx:118-125`, pero solo en `mode="full"`; detalle real usa `mode="actions"` en `src/tramites/components/details/MainView.tsx:112-121`. |
| 8 | Editor de firmante desde cliente | Parcial con riesgo crítico | `ClientMainView.tsx:177-183` y `SignerEditor`; endpoint con autorización insuficiente en `signature/route.ts`. |
| 9 | Comisión % + notas predefinidas por usuario | Desviado/parcial | `006` existe, pero API/UI usan `user_company_commissions` y `user_default_notes` de `007`; no usan `commission_pct/default_notes`. |

## Hallazgos Críticos

### CRIT-01 - `/clients/[id]/signature` expone datos personales sin autenticación en GET/POST

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/app/api/v2/clients/[id]/signature/route.ts` | 26-81 | `POST` lee `signers` por `client_id` sin `validateUserSession`. |
| `src/app/api/v2/clients/[id]/signature/route.ts` | 91-146 | `GET` replica la lectura sin autenticación. |

Impacto:

- Cualquier petición que conozca un `clientId` puede leer nombre, apellidos, email, teléfono, documento y cargo del firmante.
- Es fuga de PII y debe tratarse como bloqueo antes de producción.

Corrección recomendada:

1. Añadir `validateUserSession` a `GET` y `POST` o eliminar `POST` legacy si no es necesario.
2. Reutilizar la lógica de acceso de `src/app/api/v2/clients/[id]/route.ts:97-118` para restringir comerciales a clientes propios/subcomerciales.
3. Añadir tests de 401, 403 y acceso permitido.

### CRIT-02 - `PATCH /clients/[id]/signature` no comprueba permisos sobre el cliente

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/app/api/v2/clients/[id]/signature/route.ts` | 190-193 | Solo valida que haya sesión. |
| `src/app/api/v2/clients/[id]/signature/route.ts` | 220-227 | Busca el cliente solo por `id`, sin filtro por rol/propiedad. |
| `src/app/api/v2/clients/[id]/route.ts` | 97-118 | El endpoint de detalle sí aplica filtro por rol y subcomerciales. |

Impacto:

- Un usuario autenticado podría editar cliente/firmante de cualquier cliente si conoce el ID.

Corrección recomendada:

1. Extraer un helper de acceso a cliente o duplicar temporalmente el filtro de `clients/[id]/route.ts`.
2. Aplicarlo antes de cualquier `UPDATE`/`INSERT` de `clients` o `signers`.
3. Envolver actualización de cliente + firmante en transacción si el cliente libSQL usado lo permite, o reordenar para evitar estados parciales.

### CRIT-03 - API de métricas no es gerencia-only en servidor

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/app/api/v2/analytics/metrics/route.ts` | 219-257 | Autentica, pero no rechaza roles no admin/dirección. |
| `src/app/api/v2/analytics/metrics/route.test.js` | 66-84 | El test actual espera éxito para rol `"2"`. |
| `src/dashboard/components/ViewToggle.tsx` | 26-34 | La UI sí oculta la vista si `!isDireccion`. |

Impacto:

- La ocultación en cliente no protege el dato. Cualquier usuario autenticado puede consultar métricas agregadas llamando a la API directamente.
- Incumple el objetivo del plan: vista Métricas/KPI solo gerencia.

Corrección recomendada:

1. Añadir `if (authResult.user.role !== "admin") return 403` o usar el mismo criterio de `permissions.isDireccion` en servidor si existe helper equivalente.
2. Cambiar el test de rol `"2"` para esperar `403`.
3. Si se desea mantener métricas personales para comerciales, crear endpoint separado con contrato y nombre distintos.

### CRIT-04 - La baseline de verificación del plan no pasa

Evidencia:

| Área | Evidencia |
|---|---|
| Tests | `bun test` falla por `document is not defined` en `src/core/hooks/use-status-badge.test.tsx` y `src/comparativas/components/details/MainView.rechazar.test.tsx`. |
| Infra DOM | No existen `bunfig.toml` ni `test/setup-dom.ts`. |
| Better Auth en tests | Con DOM manual, `MainView.rechazar.test.tsx` requiere `NEXT_PUBLIC_BETTER_AUTH_URL`/`BETTER_AUTH_URL` para no fallar en `src/core/auth/auth-client.ts:5`. |
| Lint | `npm run lint` ejecuta `next lint`, que falla con Next 16. `npx eslint .` también falla por configuración circular. |

Impacto:

- La rama no cumple el criterio de verificación indicado en el plan.
- Los tests pueden pasar solo con conocimiento manual no codificado en el repositorio.

Corrección recomendada:

1. Restaurar/crear `bunfig.toml` con preload de DOM.
2. Crear `test/setup-dom.ts` y configurar variables mínimas de Better Auth para tests.
3. Añadir smoke test DOM.
4. Sustituir `next lint` por un comando compatible con Next 16 y corregir `eslint.config.mjs` para ESLint 10.

## Hallazgos Altos

### HIGH-01 - `Rechazar Cliente` queda disponible para comerciales

> Superseded by Addendum 2026-06-04: `Rechazar Cliente` queda intencionadamente disponible para comerciales.

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/comparativas/components/details/MainView.tsx` | 336-355 | El botón se renderiza con `isStudied` sin `!isComercial`. |
| `src/comparativas/components/details/MainView.tsx` | 170-207 | Handler envía `status: "rechazado_cliente"`. |
| `src/app/api/v2/comparisons/[id]/status/route.ts` | 28-40 | Schema acepta cualquier string no vacío. |
| `src/app/api/v2/comparisons/[id]/status/route.ts` | 59-82, 446-471 | Comerciales con acceso pueden actualizar la comparativa. |

Impacto:

- Un comercial puede marcar una comparativa como rechazada por cliente, aunque el plan situaba esta acción en backoffice/no comercial.

Corrección recomendada:

1. Ocultar el botón con `isStudied && !isComercial`.
2. Añadir guard server-side específico: si `status === "rechazado_cliente"` y rol `"2"`, responder `403`.
3. Añadir test de UI y route para rol comercial.

### HIGH-02 - `Fecha de Baja` no se ve en la vista real de detalle

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/tramites/components/editTramite/TramiteStatusSection.tsx` | 118-125 | Bloque `Fecha de Baja` existe, pero dentro de `mode === "full"`. |
| `src/tramites/components/details/MainView.tsx` | 112-121 | La vista principal de detalle usa `StatusCard mode="actions"`. |
| `src/tramites/components/editTramite/TramiteStatusSection.tsx` | 58-107 | La rama `actions` no muestra `rejected_date`. |

Impacto:

- El usuario que entra al detalle del trámite no ve la fecha de baja, que era el objetivo funcional.

Corrección recomendada:

1. Añadir el bloque de `Fecha de Baja` también en `mode="actions"`.
2. Crear test de componente para trámite `Baja` con `rejected_date` en ambos modos o al menos en el flujo `StatusCard mode="actions"`.

### HIGH-03 - Task 9 se ha implementado con un modelo distinto al especificado

> Superseded by Addendum 2026-06-04: el modelo `user_company_commissions` + `user_default_notes` queda aceptado como fuente de verdad.

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `docs/migrations/006_add_user_commission_config.sql` | 1-3 | Añade `commission_pct` y `default_notes`. |
| `src/core/auth/auth-schema.ts` | 11-24 | La tabla `user` no incluye `commissionPct` ni `defaultNotes`. |
| `src/app/api/v2/users/[id]/config/route.ts` | 27-31 | Schema acepta `profile`, `company_commissions`, `targeted_notes`, no `commission_pct/default_notes`. |
| `src/colaboradores/components/EditUserConfigModal.tsx` | 231-264 | Guarda comisiones por comercializadora y notas segmentadas. |
| `docs/migrations/007_add_user_company_commissions_and_targeted_notes.sql` | 1-22 | Crea tablas usadas por la implementación real. |

Impacto:

- El plan auditado no queda cumplido literalmente.
- Si solo se aplica la migración 006, la UI/API real de configuración falla porque necesita 007.
- Las columnas `commission_pct/default_notes` quedan sin uso consistente.

Corrección recomendada:

1. Decidir si la fuente de verdad es el plan original o el modelo avanzado implementado.
2. Si se mantiene el plan original, añadir `commissionPct/defaultNotes` a `auth-schema.ts`, endpoint y modal, y usar esas columnas.
3. Si se mantiene el modelo avanzado, actualizar la documentación del bloque y marcar 006 como obsoleta o complementaria, garantizando que 007 se aplique antes de usar la UI.
4. Añadir endpoint/tests para lectura/escritura del contrato final elegido.

### HIGH-04 - Las notas predefinidas no se auto-aplican al crear trámites

Evidencia:

- Búsqueda en `src/tramites` y `src/comparativas` solo encuentra `targeted_notes` en vistas de detalle: `src/tramites/components/details/MainView.tsx:79-81` y `src/comparativas/components/details/MainView.tsx:109-112`.
- No se encontró integración en el flujo de creación/conversión (`AddTramiteDialog`, formularios de creación o conversión comparativa -> trámite).

Impacto:

- El requisito de notas predefinidas queda como visualización posterior, no como pre-relleno/auto-aplicación en creación.

Corrección recomendada:

1. Localizar el punto único donde se inicializan notas del trámite.
2. Obtener notas `global` + `tramites` del usuario asignado.
3. Pre-rellenar o insertar esas notas de forma idempotente al crear el trámite.
4. Añadir test de integración/component con usuario que tiene notas.

### HIGH-05 - Métricas depende de `tramite_renewal_history` sin migración numerada de creación

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/app/api/v2/analytics/metrics/route.ts` | 391-399 | Hace `LEFT JOIN tramite_renewal_history`. |
| `docs/migrations/008_add_renewal_metrics_indexes.sql` | 1-5 | Solo añade índices; no crea la tabla. |
| `docs/RENEWAL_FLOW_MIGRATION.md` | Varias | Documenta la tabla, pero fuera de `docs/migrations/00*.sql`. |

Impacto:

- En un entorno donde la tabla no exista, `/api/v2/analytics/metrics` responderá 500 con `no such table: tramite_renewal_history`.

Corrección recomendada:

1. Añadir migración numerada para crear `tramite_renewal_history` si aún no está garantizada por producción.
2. Actualizar `docs/schema.sql`.
3. Añadir test que verifique la query esperada o, mejor, test con DB de SQLite real si el proyecto lo permite.

## Hallazgos Medios

### MED-01 - Migraciones 005 y 006 no son re-ejecutables

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `docs/migrations/005_add_comparativa_flags.sql` | 4-13 | Indica explícitamente que no es idempotente y ejecuta `ALTER TABLE` sin guarda real. |
| `docs/migrations/006_add_user_commission_config.sql` | 1-3 | Ejecuta `ALTER TABLE user ADD COLUMN` sin guarda. |

Impacto:

- Re-ejecutar las migraciones falla por columna duplicada.
- Incumple la convención del plan para migraciones SQLite/Turso.

Corrección recomendada:

1. Si aún no se aplicaron, corregir antes de aplicar.
2. Si ya se aplicaron en algún entorno, crear una nota operativa clara: no re-ejecutar y validar con `PRAGMA table_info` antes.
3. Para futuro, usar migraciones ejecutadas por un script que inspeccione `PRAGMA table_info` y solo lance `ALTER TABLE` si falta la columna, porque SQLite/libSQL no ofrece una guarda portable de columna en SQL puro.

### MED-02 - Filtros de fechas de métricas no son homogéneos

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/app/api/v2/analytics/metrics/route.ts` | 299-314 | Comparativas/trámites aplican `buildDateFilter`. |
| `src/app/api/v2/analytics/metrics/route.ts` | 330-339 | Renovaciones usan condiciones distintas y sin mismo rango temporal para renovadas. |
| `src/app/api/v2/analytics/metrics/route.ts` | 422-429 | `renewalByTariff` hereda `renewedContractsWhere`, sin rango de fecha homogéneo. |
| `src/dashboard/components/charts/MetricsView.tsx` | 20-37 | La vista mezcla tarjetas; `ComparativasRatio` no consume el mismo endpoint agregado. |

Impacto:

- El usuario puede ver KPIs aparentemente comparables pero calculados con periodos distintos.

Corrección recomendada:

1. Definir semántica única de periodo para cada KPI.
2. Aplicar el mismo contrato de filtros en API y tarjetas.
3. Preferir que `MetricsView` consuma una sola API agregada o que cada tarjeta documente y use filtros equivalentes.

### MED-03 - `POST /api/v2/comparisons` legacy pierde filtros include/exclude de compañía

> Superseded by Addendum 2026-06-04: los paths POST legacy deprecados quedan fuera de mantenimiento.

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/app/api/v2/comparisons/route.ts` | 721-741 | `handlePaginatedRequest` serializa `userFilter`, pero no `companyFilter`, `excludeCompany` ni `excludeUser`. |
| `src/app/api/v2/comparisons/route.ts` | 299-310, 438-459 | GET sí soporta esos filtros correctamente. |

Impacto:

- La UI actual usa GET, pero consumidores legacy por POST obtendrán resultados distintos.

Corrección recomendada:

1. Añadir `companyFilter`, `excludeCompany` y `excludeUser` al `URLSearchParams` interno.
2. Añadir test de POST legacy o eliminar/depurar compatibilidad si no hay consumidores reales.

### MED-04 - `PATCH /clients/[id]/signature` da falso éxito para firmante de tipo no permitido

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/app/api/v2/clients/[id]/signature/route.ts` | 251-294 | Solo procesa `signerUpdates` si el tipo está en `SIGNER_CLIENT_TYPES`. |
| `src/app/api/v2/clients/[id]/signature/route.ts` | 296 | Devuelve `{ success: true }` aunque haya ignorado el firmante. |

Impacto:

- El cliente puede creer que guardó datos que no se persistieron.

Corrección recomendada:

1. Si se envía `signer` para tipo no permitido, responder 400.
2. Añadir test del caso `Particular` + `signer`.

### MED-05 - UI de configuración de usuario es inconsistente entre tabla y grid

Evidencia:

| Archivo | Líneas | Detalle |
|---|---:|---|
| `src/colaboradores/components/UsersGrid.tsx` | 139-168 | En tabla solo admin ve columna de acciones/config. |
| `src/colaboradores/components/UsersGrid.tsx` | 368-371 | En grid admin o backoffice ven `EditUserConfigModal`. |
| `src/app/api/v2/users/[id]/config/route.ts` | 33-35, 47-54 | API permite admin y backoffice. |

Impacto:

- Un backoffice puede editar desde una vista pero no desde otra.

Corrección recomendada:

1. Unificar condición en tabla y grid.
2. Si backoffice no debe editar, endurecer endpoint; si sí debe, mostrar acción en ambas vistas.

## Hallazgos Bajos y Riesgos de Cobertura

| ID | Hallazgo | Evidencia | Riesgo |
|---|---|---|---|
| LOW-01 | Texto visible del botón no coincide con spec. | `MainView.tsx:350-353` usa aria-label con `Rechazar Cliente`, pero texto `Rechazado por cliente`. | Inconsistencia UX/tests. |
| LOW-02 | Badge fallback legacy no contempla `rechazado_cliente`. | `src/core/hooks/use-status-badge.tsx:145-155`. | Si alguien llama sin `statusType="comparativa"`, cae a default. |
| LOW-03 | No hay tests de filtros include/exclude ni `Fecha de Baja`. | Búsqueda en `src/**/*.test.*` sin `excludeCompany`, `excludeUser`, `Fecha de Baja`, `rejected_date`. | Regresiones no detectadas. |
| LOW-04 | Tests de auth con `mock.module` tras import pueden dar falsa confianza. | Patrón en `route.test.js` de flags/signature; algunos tests reimportan tras cambiar mock. | Cache de módulos puede invalidar casos negativos. |
| LOW-05 | `SignerEditor` inicializa estado desde props una sola vez. | `src/clientes/components/SignerEditor.tsx:34-44`. | Modal con datos obsoletos si cambia `signer` sin remount. |

## Requisitos Cumplidos

- `ComparativaStatus` incluye `rechazado_cliente`.
- Badge explícito para `Rechazado Cliente` existe y pasa con DOM configurado.
- Endpoint de flags existe, valida booleanos y bloquea rol comercial en `src/app/api/v2/comparisons/[id]/flags/route.ts:15-22`.
- Detalle de comparativa transforma y muestra flags permanencia/renovación.
- Toggle `Métricas` se renombró y se oculta en cliente para no dirección.
- GET de comparativas y contratos soporta `excludeCompany`/`excludeUser` en rutas principales.
- `ClientMainView` muestra `SignerEditor` para `Empresa` y `Comunidad de Propietarios`.
- Existe una implementación avanzada de configuración de usuario por comercializadora y notas segmentadas, aunque no coincide con el contrato `commission_pct/default_notes` del plan.

## Plan de Corrección Priorizado

### Fase 0 - Restaurar baseline de calidad

Objetivo: que el comando de verificación estándar sea reproducible sin conocimiento manual.

1. Crear `test/setup-dom.ts` con registro de `@happy-dom/global-registrator`.
2. Crear `bunfig.toml` con preload de `test/setup-dom.ts`.
3. En el setup de tests, definir `process.env.NEXT_PUBLIC_BETTER_AUTH_URL` y `process.env.BETTER_AUTH_URL` si no existen.
4. Añadir `test/setup-dom.smoke.test.tsx`.
5. Corregir `package.json` para que `npm run lint` use un comando compatible con Next 16.
6. Corregir `eslint.config.mjs` para que `npx eslint .` no falle con la estructura circular de `next/core-web-vitals`.
7. Criterio de salida: `bun test`, `npx tsc --noEmit` y lint pasan sin flags/env manuales.

### Fase 1 - Cerrar brechas de seguridad

Objetivo: eliminar accesos no autorizados a métricas y PII.

1. Proteger `GET`/`POST` de `/api/v2/clients/[id]/signature` con sesión.
2. Aplicar verificación de acceso a cliente en `GET`, `POST` y `PATCH` de signature.
3. Responder 403 para usuarios sin acceso al cliente.
4. Aplicar gating server-side en `/api/v2/analytics/metrics` para rol gerencia/admin.
5. Añadir tests negativos 401/403 y positivos por rol permitido.
6. Criterio de salida: ningún endpoint sensible depende solo de ocultación en UI.

### Fase 2 - Corregir gaps funcionales visibles

Objetivo: cumplir requisitos visibles del bloque.

1. Ocultar `Rechazar Cliente` para comerciales en UI.
2. Bloquear server-side `status === "rechazado_cliente"` para rol comercial si esa es la regla de negocio.
3. Mostrar `Fecha de Baja` en `mode="actions"` o mover el bloque a una zona común de `TramiteStatusSection`.
4. Alinear el texto visible del botón a `Rechazar Cliente`.
5. Añadir tests de estas rutas de UI.

### Fase 3 - Decidir y consolidar configuración de usuario

Objetivo: eliminar la divergencia `commission_pct/default_notes` vs modelo avanzado.

Opción A, cumplir plan original:

1. Añadir `commissionPct` y `defaultNotes` a `auth-schema.ts`.
2. Cambiar `/users/[id]/config` para aceptar/guardar `commission_pct/default_notes`.
3. Cambiar `EditUserConfigModal` para editar esos campos.
4. Usar `commission_pct` y `default_notes` en creación/conversión de trámites.

Opción B, formalizar implementación avanzada:

1. Actualizar documentación del bloque para declarar `user_company_commissions` y `user_default_notes` como diseño final.
2. Asegurar que migración 007 se aplica y queda incluida en el checklist operativo.
3. Eliminar o documentar el rol de `commission_pct/default_notes` para evitar columnas huérfanas.
4. Implementar auto-aplicación de `targeted_notes` y comisiones por comercializadora en creación/conversión de trámite.

Criterio de salida: una única fuente de verdad, tests de API/UI y flujo de creación cubiertos.

### Fase 4 - Robustecer métricas

Objetivo: KPIs consistentes y sin errores por esquema.

1. Crear o referenciar migración numerada que cree `tramite_renewal_history` si no existe.
2. Actualizar `docs/schema.sql`.
3. Definir la semántica temporal de `renewalRatio` y `renewalByTariff`.
4. Aplicar filtros de fecha de forma homogénea.
5. Decidir si `MetricsView` consume una sola API agregada o si cada tarjeta mantiene APIs separadas con contrato común.
6. Añadir tests de fechas para renovaciones y autorización.

### Fase 5 - Migraciones y compatibilidad

Objetivo: evitar fallos operativos en Turso/SQLite.

1. Documentar estado de aplicación de migraciones 005, 006, 007 y 008 por entorno.
2. Antes de aplicar 005/006, validar `PRAGMA table_info` y aplicar solo columnas faltantes.
3. Corregir `handlePaginatedRequest` de `POST /api/v2/comparisons` o retirar compatibilidad si no hay consumidores.
4. Añadir tests para `excludeCompany`/`excludeUser` en contratos y comparativas.

## Orden Recomendado de Ejecución

| Prioridad | Acción | Motivo |
|---:|---|---|
| 1 | Proteger `/clients/[id]/signature` | Riesgo directo de PII y modificación no autorizada. |
| 2 | Proteger `/analytics/metrics` en servidor | Evita exposición de KPIs a usuarios no gerencia. |
| 3 | Restaurar baseline `bun test`/lint | Permite validar cualquier corrección posterior. |
| 4 | Bloquear `Rechazar Cliente` para comerciales | Evita cambios de estado no autorizados. |
| 5 | Mostrar `Fecha de Baja` en detalle real | Corrige requisito visible incumplido. |
| 6 | Consolidar Task 9 | Evita deuda de esquema/API/UI y columnas sin uso. |
| 7 | Robustecer métricas/migraciones | Evita 500 por tabla ausente y KPIs inconsistentes. |
| 8 | Completar tests de filtros y compatibilidad | Reduce regresiones futuras. |

## Estado Final de la Review

El bloque 1 está **avanzado pero no cerrado**. Hay suficientes piezas implementadas para validar la dirección funcional, pero no se debe marcar como terminado hasta resolver como mínimo:

1. Autorización de `signature`.
2. Autorización server-side de métricas.
3. Baseline de tests/lint reproducible.
4. Visibilidad real de `Fecha de Baja`.
5. Restricción de `Rechazar Cliente` para comerciales.
6. Decisión y documentación/corrección de la implementación de configuración de usuario.

Después de esas correcciones, la verificación esperada debería ser:

```bash
bun test
npx tsc --noEmit
npm run lint
```

con todos los comandos pasando sin variables manuales ni preload explícito.
