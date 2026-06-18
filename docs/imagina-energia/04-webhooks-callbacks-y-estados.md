# 04 - Webhooks, Callbacks y Estados

## Tipos de callback

| Tipo | Como se activa | Proposito |
| --- | --- | --- |
| Callback de contratacion | `callback_url` en alta de contrato | Resultado de credit check, alta y firma |
| Callback de scoring | `callback_url` en credit check asincrono | Resultado del scoring independiente |
| Notificacion de cambios | `url_notificaciones_cambios_contrato` en alta | Cambios de estado/subestado del contrato |

Todos usan firma HMAC-SHA256 segun la guia oficial de seguridad.

## Headers de firma

| Header | Ejemplo | Notas |
| --- | --- | --- |
| `X-Signature` | `v1=AbCd123...` | Firma base64url sin padding, prefijada con version |
| `X-Signature-Timestamp` | `1732543800` | Timestamp Unix en segundos |
| `X-Signature-Algorithm` | `HS256` | Algoritmo esperado |
| `Content-Type` | `application/json` | Payload JSON |

## Algoritmo de validacion

1. Leer el JSON completo.
2. Extraer y eliminar `_callback_signature` si viene en el body.
3. Mantener los campos que si forman parte de la firma, incluido `_metadata` en notificaciones.
4. Canonicalizar JSON con claves ordenadas y sin espacios.
5. Construir el mensaje: `{timestamp}.{url_completa}.{payload_canonical}`.
6. Calcular HMAC-SHA256 con `IMAGINA_CALLBACK_SEED_KEY`.
7. Codificar digest con base64url sin padding.
8. Comparar con `X-Signature` sin el prefijo `v1=`, usando comparacion constante en tiempo.
9. Rechazar timestamps con deriva superior a 5 minutos.

Importante: la URL debe coincidir exactamente con la URL publica usada por Imagina Energia, incluyendo protocolo, host, path y query string.

En Negoco, esa URL publica debe incluir el subdominio del tenant. No debemos usar una URL global comun para todos los tenants, porque necesitamos resolver el branch/base Turso correcto antes de aplicar cambios de estado.

Ejemplos:

- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratacion`
- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/scoring`
- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratos`

## Campos incluidos en firma

| Callback | Campos incluidos | Campo excluido |
| --- | --- | --- |
| Notificacion de cambios | `tabla`, `tipo_evento`, `timestamp`, `contrato`, `cambios`, `_metadata` | `_callback_signature` |
| Credit check asincrono | `request_id`, `referencia_externa`, `result` o `error` | `_callback_signature` |
| Contratacion | En exito: `credit_result`, `contrato_result`, `firma_result`. En error: `request_id`, `referencia_externa`, `error` | `_callback_signature` |

## Callback de contratacion

Estructura representativa:

```json
{
  "request_id": 408,
  "referencia_externa": "REF-2026-001234",
  "credit_result": {
    "status_code": 200,
    "result_operation": "Aprobado",
    "result_code": 1,
    "raw": {}
  },
  "contrato_result": {
    "result_operation": "OK",
    "content": {
      "id": 543856,
      "codigo": "2511000868",
      "estado": { "descripcion": "Pendiente" },
      "subestado": { "subestado": "pendiente sin revisar", "descripcion": "Pendiente sin revisar" },
      "cliente": { "identificador": "12345678A", "nombre": "Juan" },
      "punto_suministro": { "cups": "ES0026000010979933FW" },
      "iban": "ES9121000418450200051332",
      "bic_swift": "CAIXESBBXXX",
      "codigo_mandato": "14462511000868000001"
    }
  },
  "firma_result": {
    "result_code": null,
    "result_operation": "ERROR(Error sending contract for signature...)"
  },
  "_callback_signature": {
    "version": "v1",
    "signature": "...",
    "timestamp": "1772552356"
  }
}
```

Procesamiento interno:

- Validar firma antes de tocar negocio.
- Correlacionar por `request_id` y `referencia_externa`.
- Si `contrato_result.result_operation === "OK"`, persistir `contrato_result.content.id` y `codigo`.
- No tratar error de `firma_result` en PRE como fallo total si el contrato se creo correctamente.
- Encolar subida de documentos despues de persistir contrato.

## Notificaciones de cambios de contrato

Se reciben al endpoint configurado en `url_notificaciones_cambios_contrato`.

Estas notificaciones son push desde Imagina Energia: no necesitamos un cron para conocer los cambios normales de estado. Al crear el contrato debemos enviar una URL publica nuestra con subdominio de tenant en `url_notificaciones_cambios_contrato`; a partir de ahi Imagina hara `POST` automaticos cada vez que cambien los campos monitorizados, especialmente Estado y Subestado.

El cron queda solo como mecanismo de reconciliacion/seguridad, no como fuente primaria:

- Recuperar cambios si nuestro endpoint estuvo caido.
- Detectar callbacks perdidos tras agotar reintentos.
- Completar datos que no vengan en el webhook, por ejemplo fecha oficial de activacion.
- Auditar diferencias entre el estado local y el estado real en Imagina.

Payload representativo:

```json
{
  "tabla": "contratos_suministro",
  "tipo_evento": "UPDATE",
  "timestamp": "2025-11-26T16:21:54.298664Z",
  "contrato": {
    "id": 543911,
    "codigo": "543911555"
  },
  "cambios": [
    {
      "campo": "Estado",
      "campo_tecnico": "id_estado",
      "valor_anterior": 2,
      "valor_nuevo": 3,
      "descripcion_anterior": "Pendiente",
      "descripcion_nueva": "Activable"
    }
  ],
  "_metadata": {
    "notification_id": 5,
    "attempt_number": 1
  },
  "_callback_signature": {
    "version": "v1",
    "algorithm": "HS256",
    "signature": "...",
    "timestamp": "1764174114"
  }
}
```

Reglas:

- Responder `200` rapido y procesar en background si hay trabajo pesado.
- Usar `_metadata.notification_id` como clave de idempotencia.
- Usar `_metadata.attempt_number` para detectar reintentos.
- Las columnas monitorizadas documentadas son Estado y Subestado.
- La documentacion indica reintentos cada 30 minutos hasta 10 intentos si no respondemos `200`.

Arquitectura interna recomendada:

1. Endpoint publico recibe el `POST`.
2. Lee el body bruto y valida HMAC antes de negocio.
3. Resuelve tenant por el subdominio de la URL publica recibida.
4. Inserta el evento en una tabla de eventos de integracion con clave unica por `notification_id`.
5. Responde `200` cuando el evento queda aceptado.
6. Procesa el cambio de estado de forma idempotente.
7. Registra historial en el tramite aunque el estado Negoco no cambie.

## Estados y subestados

### Estado 1 - Pendiente

| Subestado | Descripcion |
| --- | --- |
| `1` | Pendiente de firma |
| `2` | Borrador |
| `23` | Pendiente sin revisar |
| `6` | Incidencia |
| `28` | Incidencia respondida |
| `50` | Firmado |

### Estado 2 - Activable

| Subestado | Descripcion |
| --- | --- |
| `6` | Incidencia |
| `28` | Incidencia respondida |
| `20` | Pendiente |
| `27` | Pendiente de solicitud |
| `3` | Solicitado |
| `4` | Aceptado |
| `5` | Rechazado |
| `8` | Anulacion solicitada |
| `31` | Incidencia en Campo |
| `21` | Pendiente fecha activacion, sin uso |

### Estado 3 - Activo

| Subestado | Descripcion |
| --- | --- |
| `9` | Activo |
| `10` | Saliente |
| `11` | Modificacion |
| `26` | Modificacion Rechazada |
| `30` | Reposicion solicitada |
| `12` | Corte |
| `14` | Cortado |
| `13` | Baja |
| `22` | Renovado, sin uso |

### Estado 4 - Cancelado

| Subestado | Descripcion |
| --- | --- |
| `15` | Anulado |
| `16` | Firma rechazada |
| `24` | Scoring rechazado |

### Estado 5 - Finalizado

| Subestado | Descripcion |
| --- | --- |
| `29` | Repuesto |
| `25` | Desistimiento |
| `17` | Aceptado por e1 |
| `19` | Finalizado |

## Mapeo operativo a estados Negoco

En el flujo operativo por defecto usamos firma automatica de Imagina. El flujo diferido/manual queda soportado por la integracion de firma, pero requiere un estado Negoco especifico para contratos cuya firma todavia no se ha enviado.

| Evento Imagina | Estado Negoco | Regla |
| --- | --- | --- |
| Callback de contratacion con `credit_result` aprobado, `contrato_result` correcto y `firma_result` correcto | `Pendiente de Firma` | La firma ya se ha enviado al cliente |
| Estado `1` Pendiente, subestado `1` Pendiente de firma | `Pendiente de Firma` | Mantener estado si ya estaba en firma |
| Estado `1` Pendiente, subestado `50` Firmado | `Procesando` | El cliente ya firmo; comienza el proceso operativo hasta activacion |
| Estado `2` Activable, subestados `20`, `27`, `3`, `4` o similares | `Procesando` | Contrato firmado y en tramite con distribuidora/sistema Imagina |
| Estado `3` Activo, subestado `9` Activo | `Activo` | Activacion confirmada por Imagina |
| Estado/subestado de incidencia recuperable | `Incidencia` | Requiere gestion manual |
| Estado `4` Cancelado, subestado `16` Firma rechazada o `24` Scoring rechazado | `KO` o `Scoring` | `24` se mapea a `Scoring`; firma rechazada o cancelacion definitiva a `KO` |

No debemos pasar a `Activo` por inferencia temporal ni por el mero hecho de que el cliente firme. El paso a `Activo` debe venir de una notificacion de Imagina de Estado `3`/Subestado `9` o de una reconciliacion posterior por volcado/consulta que confirme ese estado.

Al recibir `Activo`, actualizar `tramites.activation_date`. Si la notificacion no trae una fecha de activacion fiable, encolar una consulta/volcado del contrato de Imagina para obtener el dato oficial; si no existe dato oficial, usar el timestamp del webhook como fallback operativo y dejar trazabilidad en el historial.

## Endpoint interno recomendado

Para Imagina Energia, reservar rutas separadas bajo el host publico de cada tenant:

- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratacion`
- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/scoring`
- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratos`

Cada ruta debe resolver tenant por subdominio. Evitar query strings para identificar tenant salvo necesidad explicita, porque la URL exacta participa en la firma.
