# Runbook de Pendientes - Imagina Energia

Fecha: 2026-06-18

Este documento separa las tareas pendientes en dos bloques:

- **Tareas operativas y de migracion:** acciones que debe ejecutar o validar manualmente el equipo/tenant.
- **Tareas de codigo:** mejoras o cierres tecnicos pendientes en el repo.

## Tareas Operativas y de Migracion

### 1. Aplicar migracion SQL por tenant

Archivo:

- `docs/migrations/008_imagina_energia_integration.sql`

Pasos:

1. Revisar `PRAGMA table_info(...)` antes de ejecutar cada `ALTER TABLE`, porque SQLite/libSQL no soporta `ADD COLUMN IF NOT EXISTS` de forma portable.
2. Ejecutar los `CREATE TABLE IF NOT EXISTS`.
3. Ejecutar solo los `ALTER TABLE` cuyas columnas no existan todavia.
4. Crear indices.
5. Validar que existen:
   - `integrations`
   - columnas Imagina en `comercializadora_rates`
   - columnas estructuradas en `contracts`, `clients`, `signers`
   - tablas `imagina_*`

### 2. Configurar integracion tenant

Por cada tenant/canal Imagina:

```sql
INSERT INTO integrations (id, provider, enabled, config)
VALUES (
  'imagina-energia',
  'imagina_energia',
  1,
  '{"x_canal_id":"<valor-proporcionado-por-imagina>"}'
)
ON CONFLICT(provider) DO UPDATE SET
  enabled = excluded.enabled,
  config = excluded.config,
  updated_at = datetime('now');
```

No compartir ni exponer `x_canal_id` en frontend.

### 3. Configurar variables de entorno

Requeridas en todos los entornos:

- `IMAGINA_EMAIL`
- `IMAGINA_PASSWORD`
- `IMAGINA_CALLBACK_SEED_KEY`
- `IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN`

Requeridas en desarrollo local y Vercel preview:

- `IMAGINA_AUTH_BASE_URL_PRE`
- `IMAGINA_API_BASE_URL_PRE`

Requeridas en produccion:

- `IMAGINA_AUTH_BASE_URL_PROD`
- `IMAGINA_API_BASE_URL_PROD`

Opcional:

- `IMAGINA_REQUEST_TIMEOUT_MS`

Regla actual del codigo:

- Desarrollo local usa PRE y exige `IMAGINA_AUTH_BASE_URL_PRE` e `IMAGINA_API_BASE_URL_PRE`.
- Vercel preview usa PRE y exige `IMAGINA_AUTH_BASE_URL_PRE` e `IMAGINA_API_BASE_URL_PRE`.
- Produccion usa PROD y exige `IMAGINA_AUTH_BASE_URL_PROD` e `IMAGINA_API_BASE_URL_PROD`.
- No hay URLs hardcodeadas, fallbacks, overrides manuales ni reutilizacion cruzada entre PRE y PROD. Si falta una URL requerida para el entorno runtime, la conexion con Imagina no se establece.

### 4. Validar dominio publico de callbacks

Confirmar que Imagina puede llamar a:

- `https://{tenant}.{IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN}/api/webhooks/imagina-energia/contratacion`
- `https://{tenant}.{IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN}/api/webhooks/imagina-energia/scoring`
- `https://{tenant}.{IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN}/api/webhooks/imagina-energia/contratos`

La URL exacta participa en la firma HMAC, asi que protocolo, host, path y query deben coincidir.

### 5. Sincronizar tarifas Imagina

Ejecutar por tenant:

```http
GET /api/v2/integrations/imagina-energia/tarifas
```

Validar que se guardan tarifas en `comercializadora_rates` con:

- `provider = imagina_energia`
- `external_rate_id = id_tarifa_precios`
- `raw`
- `synced_at`
- `enabled = 1`

### 6. Completar datos obligatorios antes de enviar altas

Para cada contrato a enviar, completar:

- `contracts.rate_id`
- direccion CNMC de suministro: `tipo_via_cnmc`, `calle`, `numero_finca`
- direccion CNMC del titular en `clients`
- potencias P1..P6 en kW en CRM
- `clients.phone_prefix`
- `contracts.signature_channel` si se quiere sobrescribir el defecto `sms`
- `clients.cnae` para empresas
- firmante empresa con `signers.document_type` y `signers.phone_prefix`

### 7. Validaciones PRE con Imagina

Confirmar con Imagina en PRE:

- disponibilidad de `/creditcheck_gas`
- disponibilidad de `/creditcheck_no_sips`
- disponibilidad de `/creditcheck_no_sips_gas`
- soporte real de `url_notificaciones_cambios_contrato`
- soporte real de `margenes_tarifa_precios`
- unidades definitivas de fees energia/autoconsumo
- tipo documental esperado para DNI/NIE/CIF
- funcionamiento de firma en PRE
- reintentos de webhooks y HMAC con subdominio tenant

## Tareas de Codigo Pendientes

### 1. Crear UI/admin para configurar integraciones

Pendiente una pantalla interna o herramienta segura para:

- activar/desactivar `imagina_energia`
- introducir `config.x_canal_id`
- validar configuracion sin exponer el valor al frontend

### 3. Completar formularios de datos CNMC

Falta UI para editar de forma estructurada:

- `tipo_via_cnmc`
- `calle`
- `numero_finca`
- `aclarador_finca`
- `tipo_autoconsumo_cnmc`
- datos equivalentes del titular

### 4. Completar campos empresa/firmante

Falta UI y validacion de formulario para:

- `clients.cnae`
- `signers.document_type`
- `clients.phone_prefix`
- `signers.phone_prefix`
- `contracts.signature_channel`

### 5. Anadir runner idempotente de migraciones tenant

La migracion SQL documenta el orden, pero seria mejor crear un runner que:

- lea `PRAGMA table_info`
- aplique columnas faltantes
- evite fallos al reejecutar
- registre version de migracion aplicada por tenant

### 6. Ampliar tests de rutas webhook

Ya existen tests unitarios del core, pero faltan tests de route handlers para:

- `POST /api/webhooks/imagina-energia/contratacion`
- `POST /api/webhooks/imagina-energia/scoring`
- `POST /api/webhooks/imagina-energia/contratos`

Casos minimos:

- firma invalida devuelve `401`
- duplicado devuelve `success: true, duplicate: true`
- payload valido inserta evento y aplica mapper

### 7. Resolver `type-check` bloqueado por `.next/dev/types`

`pnpm type-check` queda bloqueado por referencias stale en `.next/dev/types/validator.ts` a rutas que no existen. Pendiente limpiar/regenerar esos tipos o ajustar el include para que el type-check no dependa de artefactos obsoletos.

### 8. Mejorar trazabilidad documental

El codigo intenta subir documentos tras callback correcto, pero quedan mejoras:

- mapear tipos documentales desde metadata real del archivo
- calcular y guardar hash de archivo para deduplicacion fuerte
- reintentar solo errores transitorios
- mostrar en UI el estado de subida documental a Imagina

### 9. Reconciliacion periodica

Existe soporte de consulta/dump, pero falta programar el proceso periodico para:

- contratos no terminales
- comparacion estado local vs estado Imagina
- aplicacion del mismo mapper de estados
- historial/auditoria de diferencias

### 10. Margenes y fees

El soporte documental esta contemplado, pero falta cerrar:

- UI de captura de margenes
- validacion local completa contra limites de `raw`
- envio de `margenes_tarifa_precios` en alta cuando proceda

## Tareas de Codigo Resueltas

### 2. Completar UI de seleccion de tarifa Imagina

El backend exige `contracts.rate_id`. La experiencia completa permite:

- listar tarifas sincronizadas de Imagina
- seleccionar tarifa en contrato
- mostrar `alias_externo`, `codigo_atr`, `descripcion`
- evitar seleccionar tarifas no sincronizadas o deshabilitadas

Nota de cierre: la UI incluye el selector de tarifa en contrato y una pestana de
solo lectura en el detalle de Imagina Energia, visible unicamente cuando la
integracion del tenant esta configurada.
