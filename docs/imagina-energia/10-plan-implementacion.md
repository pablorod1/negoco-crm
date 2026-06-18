# Integracion Imagina Energia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar de forma completa Imagina Energia para volcado de contratos, altas, scoring, tarifas, firma, documentos, callbacks y actualizacion de estados por webhook.

**Architecture:** Crear un modulo servidor `src/core/integrations/imagina-energia` con cliente HTTP, autenticacion por llamada, validacion de firmas, schemas y mappers. Exponer rutas internas bajo `src/app/api/v2/integrations/imagina-energia/*` y callbacks publicos bajo `src/app/api/webhooks/imagina-energia/*`, siguiendo el patron existente de `src/app/api/webhooks/abarca/route.ts`. Las credenciales JWT son globales de Negoco Cloud, pero `X-Canal` es obligatorio y se resuelve por tenant.

**Tech Stack:** Next.js App Router, TypeScript, `fetch`, Zod, libSQL/Turso via `getTursoClientByTenant`, Vitest, `pnpm`.

---

## File Structure

- Create: `src/core/integrations/imagina-energia/config.ts` - lee y valida variables de entorno.
- Create: `src/core/integrations/imagina-energia/auth.ts` - obtiene JWT global en cada llamada.
- Create: `src/core/integrations/imagina-energia/client.ts` - wrapper HTTP con `Authorization`, `X-Canal` obligatorio, timeouts y rate-limit handling.
- Create: `src/core/integrations/imagina-energia/signature.ts` - validacion HMAC-SHA256 de callbacks.
- Create: `src/core/integrations/imagina-energia/schemas.ts` - Zod schemas de requests, responses y callbacks.
- Create: `src/core/integrations/imagina-energia/mappers.ts` - mapea contratos/tramites locales a payload Imagina.
- Create: `src/core/integrations/imagina-energia/integration-config.ts` - lee configuracion tenant de la tabla `integrations`.
- Create: `src/core/integrations/imagina-energia/index.ts` - API publica del modulo.
- Modify: `src/tramites/components/editTramite/UpdateTramiteStatusModal.tsx` - muestra switch de envio a Imagina solo al pasar a `Verificado` y solo si el tenant/canal es elegible.
- Create: `src/app/api/v2/integrations/imagina-energia/tarifas/route.ts` - consulta tarifas.
- Create: `src/app/api/v2/integrations/imagina-energia/status/route.ts` - devuelve si el tenant tiene Imagina configurado sin exponer `x-canal-id`.
- Create: `src/app/api/v2/integrations/imagina-energia/contracts/sync/route.ts` - volcado paginado.
- Create: `src/app/api/v2/integrations/imagina-energia/contracts/submit/route.ts` - alta contrato.
- Create: `src/app/api/v2/integrations/imagina-energia/scoring/route.ts` - scoring independiente.
- Create: `src/app/api/v2/integrations/imagina-energia/signature/route.ts` - envio, reenvio, consulta y health check de firma.
- Create: `src/app/api/webhooks/imagina-energia/contratacion/route.ts` - callback de alta.
- Create: `src/app/api/webhooks/imagina-energia/scoring/route.ts` - callback de scoring.
- Create: `src/app/api/webhooks/imagina-energia/contratos/route.ts` - notificaciones de cambios.
- Test: `src/core/integrations/imagina-energia/*.test.ts` - auth/client/signature/mappers.
- Test: `src/app/api/webhooks/imagina-energia/**/*.test.ts` - callbacks e idempotencia.

## Task 1: Configuracion, Tenant y Cliente HTTP

**Files:**
- Create: `src/core/integrations/imagina-energia/config.ts`
- Create or modify DB migration for tenant Turso config
- Create: `src/core/integrations/imagina-energia/auth.ts`
- Create: `src/core/integrations/imagina-energia/client.ts`
- Test: `src/core/integrations/imagina-energia/client.test.ts`

- [ ] **Step 1: Crear config tipada**

Validar estas variables al iniciar el modulo:

```ts
export type ImaginaEnergiaConfig = {
  authBaseUrl: string;
  apiBaseUrl: string;
  email: string;
  password: string;
  callbackSeedKey: string;
  webhookPublicBaseUrl: string;
};
```

`X-Canal` no forma parte de esta config global. Debe venir de la configuracion del tenant que esta ejecutando la operacion.

- [ ] **Step 1.1: Crear tabla tenant `integrations`**

Crear una tabla generica en cada branch/base Turso tenant para soportar esta y futuras integraciones:

```sql
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Para Imagina Energia, guardar una fila con `provider = 'imagina_energia'` y `config` JSON:

```json
{
  "x_canal_id": "identificador-proporcionado-por-imagina"
}
```

El backend debe resolver `x_canal_id` desde esta tabla. El frontend solo debe recibir booleanos de estado/configuracion, nunca el valor real.

- [ ] **Step 2: Implementar auth por llamada**

`getImaginaToken()` debe hacer `POST /initiateauthcommand` cada vez que el cliente vaya a llamar a un endpoint funcional. No debe depender de cache porque Imagina Energia recomendo obtener token en cada llamada.

- [ ] **Step 3: Implementar cliente**

Exponer metodos base:

```ts
request<T>(method: "GET" | "POST", path: string, options?: {
  tenantId: string;
  channelId: string;
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  formData?: FormData;
  useAuthBaseUrl?: boolean;
}): Promise<{ data: T; requestId?: string | number; headers: Headers }>;
```

`channelId` es el identificador proporcionado por Imagina Energia para el tenant y se envia siempre como `X-Canal`. Si falta, el cliente debe fallar antes de llamar a Imagina.

- [ ] **Step 4: Tests**

Cubrir token solicitado por llamada, rechazo cuando falta `X-Canal`, `Retry-After` en 429 y parseo de errores. Ejecutar:

```bash
pnpm test src/core/integrations/imagina-energia/client.test.ts
pnpm type-check
```

## Task 2: Schemas y Validacion HMAC

**Files:**
- Create: `src/core/integrations/imagina-energia/signature.ts`
- Create: `src/core/integrations/imagina-energia/schemas.ts`
- Test: `src/core/integrations/imagina-energia/signature.test.ts`

- [ ] **Step 1: Implementar canonicalizacion**

La funcion debe ordenar claves de forma recursiva y serializar sin espacios para que el mensaje sea `{timestamp}.{url}.{payload}`.

- [ ] **Step 2: Eliminar `_callback_signature` antes de validar**

Mantener `_metadata` para notificaciones de cambios.

- [ ] **Step 3: Validar timestamp**

Rechazar timestamps con deriva mayor a 300 segundos.

- [ ] **Step 4: Tests**

Cubrir firma valida, firma invalida, timestamp viejo, payload con `_callback_signature` y payload con `_metadata`.

## Task 3: Tarifas, Fees y Scoring

**Files:**
- Create: `src/app/api/v2/integrations/imagina-energia/tarifas/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/scoring/route.ts`
- Modify: UI o servicio que seleccione tarifa en tramites, cuando se conecte con el flujo de contratacion.

- [ ] **Step 1: `GET /tarifas` interno**

Devolver tarifas normalizadas y conservar `raw` para campos de limites.

- [ ] **Step 2: Sincronizar con `comercializadora_rates`**

Guardar tarifas de Imagina en la tabla tenant `comercializadora_rates` asociadas a la comercializadora Imagina Energia. Persistir `id_tarifa_precios` como identificador externo (`external_rate_id`) para enviarlo posteriormente como `id_tarifa` en altas.

Si la tabla actual no tiene columnas para proveedor, identificador externo y payload bruto, crear migracion compatible:

- `provider`
- `external_rate_id`
- `alias_externo`
- `codigo_atr`
- `descripcion`
- `raw`
- `synced_at`
- `enabled`

- [ ] **Step 3: Seleccion de tarifa en envio**

El mapper de alta debe exigir una tarifa Imagina seleccionada para el contrato. Si no existe, no enviar a Imagina y devolver error accionable.

- [ ] **Step 4: Validador de margenes**

Validar `margenes_tarifa_precios` contra `valor_p{n}_min/max_*`. Si min y max son cero, bloquear ese fee.

- [ ] **Step 5: Scoring independiente**

Enviar `callback_url`, `referencia_externa`, producto luz/gas y modalidad SIPS/no-SIPS. Persistir `request_id`.

- [ ] **Step 6: Tests**

Cubrir tarifas indexadas, limites cero, fee fuera de rango y payload no-SIPS que rechaza `cups`/`cae`.

## Task 4: Alta de Contratos y Documentos

**Files:**
- Modify: `src/tramites/components/editTramite/UpdateTramiteStatusModal.tsx`
- Modify: `src/tramites/components/details/MainView.tsx`
- Modify: `src/tramites/components/details/StatusCard.tsx`
- Modify: `src/tramites/components/editTramite/TramiteStatusSection.tsx`
- Create: `src/core/integrations/imagina-energia/integration-config.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/status/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/contracts/submit/route.ts`
- Create: `src/app/api/v2/integrations/imagina-energia/contracts/sync/route.ts`
- Create: servicio interno para `POST /documento`

- [ ] **Step 1: Pasar contratos al modal de estado**

`MainView` ya tiene `contracts`, pero `StatusCard`, `TramiteStatusSection` y `UpdateTramiteStatusModal` no los reciben. Pasar `contracts: ContractDB[]` por esa cadena para poder evaluar `contract.new_company` en el modal sin pedir el tramite a un endpoint nuevo.

- [ ] **Step 2: Resolver comercializadora por nombre en cliente**

Usar `useActiveEnergySuppliers` o `useEnergySupplierById` para resolver `contract.new_company` contra las comercializadoras activas del tenant:

1. Buscar primero por `supplier.id === contract.new_company`.
2. Mantener compatibilidad buscando tambien por `supplier.name === contract.new_company`.
3. Normalizar nombre y comparar con `Imagina Energía`.
4. No comparar nunca con IDs fijos como `COM-001`, porque varian por tenant.

- [ ] **Step 3: Consultar estado de integracion tenant**

Crear `GET /api/v2/integrations/imagina-energia/status`, que no recibe tramite. Solo lee la tabla tenant `integrations` y devuelve:

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "configured": true
  }
}
```

`configured` debe ser `true` solo si existe fila `provider = 'imagina_energia'`, `enabled = 1` y `config.x_canal_id` tiene valor. No devolver `x_canal_id` al cliente.

- [ ] **Step 4: Switch en `UpdateTramiteStatusModal.tsx`**

Mostrar un switch solo si:

- El estado destino es `Verificado`.
- La comercializadora destino resuelta por nombre es `Imagina Energía`.
- El endpoint de estado de integracion devuelve `enabled: true` y `configured: true`.

El switch debe estar desactivado por defecto para que el usuario decida si envia el alta a Imagina en ese cambio de estado.

- [ ] **Step 5: Segundo switch de firma**

El flujo operativo por defecto usa la firma automatica de Imagina cuando se active el switch de alta a Imagina.

La integracion completa debe implementar tambien `POST /firma`, `POST /firma/reenviar`, `GET /firma/{circuito_id}` y `GET /firma-health`. El control de UI para no enviar firma con el alta queda condicionado a anadir un estado Negoco especifico para contratos cuya firma todavia no se ha enviado al cliente. No usar `Pendiente de Firma` para ese caso.

- [ ] **Step 6: Disparo tras guardar estado**

Primero ejecutar el PATCH existente `/api/v2/contracts/${tramite.id}/status`. Solo si responde `success: true` y el switch esta activo, llamar al endpoint interno de alta Imagina. Esto evita enviar a Imagina si el estado local no se actualizo.

- [ ] **Step 7: Mapper residencial/empresa**

Mapear datos locales a payloads de `POST /contrato/residencial` y `POST /contrato/empresa`, incluyendo `callback_url`, `referencia_externa`, `url_notificaciones_cambios_contrato`, flags C1/C2/A3 y firma.

`callback_url` y `url_notificaciones_cambios_contrato` deben construirse con el subdominio publico del tenant:

- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratacion`
- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratos`

Estas URLs no deben exponer `x_canal_id`; el tenant se resuelve por host/subdominio al recibir el webhook.

- [ ] **Step 7.1: Validador de datos obligatorios**

Antes de llamar a Imagina, ejecutar un validador servidor que cargue tramite, contrato, cliente, firmante, integracion y tarifa seleccionada. Debe devolver una lista de faltantes accionables y bloquear el envio si faltan datos obligatorios de Imagina.

El validador debe cubrir: tarifa externa Imagina, direccion CNMC de suministro y titular, potencias/unidad, CNAE empresa, firmante empresa, tipo de documento, prefijo telefonico y canal de firma.

- [ ] **Step 8: Alta asincrona**

Guardar `request_id` y estado interno `imagina_pending` tras `202`.

- [ ] **Step 9: Volcado**

Implementar paginado con `por_pagina=500` hasta pagina vacia o parcial.

- [ ] **Step 10: Documentos**

Subir documentos solo despues de callback de contrato creado correctamente.

## Task 5: Webhooks de Contratacion, Scoring y Estados

**Files:**
- Create: `src/app/api/webhooks/imagina-energia/contratacion/route.ts`
- Create: `src/app/api/webhooks/imagina-energia/scoring/route.ts`
- Create: `src/app/api/webhooks/imagina-energia/contratos/route.ts`
- Create: `src/core/integrations/imagina-energia/reconciliation.ts`

- [ ] **Step 1: Resolver tenant**

Resolver tenant por subdominio publico. Las URLs enviadas a Imagina deben incluir el subdominio de tenant para seleccionar el branch/base Turso correcto al recibir el callback. Recordar que la URL exacta participa en la firma HMAC.

- [ ] **Step 2: Validar firma antes de negocio**

Responder `401` si HMAC falla. No persistir payload no validado salvo logs de seguridad minimizados.

- [ ] **Step 3: Idempotencia**

Usar `request_id` para callbacks de contratacion/scoring y `_metadata.notification_id` para cambios de contrato.

- [ ] **Step 4: Actualizar CRM**

Actualizar contrato/tramite local con `contrato.id`, `codigo`, scoring, firma y estado/subestado.

Mapeo inicial de estados:

- `credit_result` aprobado + contrato creado + firma enviada: `Pendiente de Firma`.
- Subestado Imagina `Firmado`: `Procesando`.
- Estado/subestado activable, solicitado o aceptado por distribuidora: `Procesando`.
- Estado Imagina activo: `Activo`.
- Scoring denegado por impagos/riesgo/motivo externo: `Scoring`.
- Revision manual, error recuperable o incidencia operativa: `Incidencia` o estado anterior con nota interna, segun criticidad.
- Firma rechazada, scoring rechazado final o cancelacion definitiva: `KO`.

- [ ] **Step 5: Tests**

Cubrir duplicados, reintentos, firma invalida, callback de exito y callback con error.

- [ ] **Step 6: Reconciliacion periodica**

Implementar un proceso periodico de reconciliacion como red de seguridad, no como mecanismo principal de estados. La fuente primaria son los webhooks automaticos de Imagina configurados con `url_notificaciones_cambios_contrato`.

La reconciliacion debe consultar contratos en estados no terminales (`Pendiente de Firma`, `Procesando`, `Incidencia` recuperable) y comparar el estado local con el estado real de Imagina por `contrato_id`/`codigo`. Si detecta diferencia, debe aplicar el mismo mapper de estados que usan los webhooks y dejar trazabilidad.

## Task 6: Verificacion

- [ ] **Step 1: Type-check**

```bash
pnpm type-check
```

- [ ] **Step 2: Tests enfocados**

```bash
pnpm test src/core/integrations/imagina-energia
pnpm test src/app/api/webhooks/imagina-energia
```

- [ ] **Step 3: Prueba PRE**

Con credenciales de PRE, ejecutar en orden: login, tarifas, scoring con callback de prueba, alta con callback, notificacion de estado y subida de documento.
