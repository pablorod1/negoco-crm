# 07 - Firma Digital

## Endpoints

| Endpoint | Uso | Respuesta |
| --- | --- | --- |
| `POST /firma` | Enviar contrato existente a firma | Sincrona |
| `POST /firma/reenviar` | Reenviar solicitud de firma | Sincrona |
| `GET /firma/{circuito_id}` | Consultar estado de firma | Sincrona |
| `GET /firma-health` | Health check del servicio de firma | Sincrona |

Todos requieren JWT excepto `GET /firma-health` segun OpenAPI.

## Envio inicial

Usar `POST /firma` cuando:

- Se creo contrato con `no_enviar_firma: true`.
- Queremos controlar el momento exacto de envio.
- Queremos elegir canal especifico fuera del alta.

`POST /firma` forma parte de la integracion completa. En el flujo normal de alta no se llama manualmente porque el contrato se envia a Imagina con firma automatica. Se usara para contratos creados con `no_enviar_firma: true`, reenvios, recuperacion de errores y consultas cuando este habilitado el estado especifico para contratos con firma pendiente de envio.

Payload:

```json
{
  "contrato_id": 369877,
  "canal_envio": "email",
  "direcciones_firma": "cliente@example.com",
  "referencia_externa": "CRM-DEAL-12345"
}
```

Campos:

| Campo | Regla |
| --- | --- |
| `contrato_id` | ID de Imagina Energia, normalmente `contrato_result.content.id` |
| `canal_envio` | `email`, `sms`, `email_otp` |
| `direcciones_firma` | Depende de canal |
| `referencia_externa` | Opcional, recomendable |

Formato de `direcciones_firma`:

| Canal | Formato |
| --- | --- |
| `email` | `cliente@example.com` |
| `sms` | `606123456` o `+34606123456` |
| `email_otp` | `cliente@example.com;606123456` |

Respuesta:

```json
{
  "request_id": 12345,
  "firma_result": {
    "status": "success",
    "message": "Contrato enviado para firma digital",
    "circuito_id": "123456"
  },
  "referencia_externa": "CRM-DEAL-12345"
}
```

Guardar `circuito_id`. Es necesario para reenvio y consulta.

## Flujo diferido/manual

Para activar este flujo en UI, antes hay que crear un estado Negoco que represente que la firma todavia no se ha enviado al cliente, por ejemplo `Pendiente de Envio de Firma`.

1. Alta de contrato con `no_enviar_firma: true`.
2. Callback de contratacion confirma `credit_result` aprobado y `contrato_result.result_operation === "OK"`.
3. Guardamos `contrato_id`, `codigo` y estado interno `signature_status = not_sent`.
4. El tramite queda en el nuevo estado especifico de firma pendiente de envio.
5. El usuario ejecuta la accion "Enviar firma".
6. Nuestro backend llama a `POST /firma` usando el `X-Canal` del tenant.
7. Si la respuesta es correcta, guardamos `circuito_id`, cambiamos `signature_status = sent` y pasamos a `Pendiente de Firma`.
8. Cuando Imagina notifique subestado `Firmado`, pasamos el tramite a `Procesando`.

No llamar a `POST /firma` antes de recibir `contrato_id`, porque ese identificador solo existe cuando Imagina ha creado correctamente el contrato.

## Reenvio

Endpoint:

```http
POST /firma/reenviar
```

Payload:

```json
{
  "circuito_id": "123456",
  "mode": "ds",
  "referencia_externa": "REENVIO-2026-001"
}
```

`mode`:

- `ds`: drawing signature.
- `os`: one-time certificate.
- `ud`: upload and draw.
- Default documentado: `ds`.

La guia permite reenvio ilimitado, pero recomienda esperar al menos 1 hora entre reenvios y consultar estado antes.

## Consulta de estado

```http
GET /firma/123456?referencia_externa=CONSULTA-001
```

Respuesta representativa:

```json
{
  "request_id": 790,
  "circuito_id": "123456",
  "estado": "en_proceso",
  "en_proceso": true,
  "fecha_inicio": "2024-06-09T10:30:00+02:00",
  "fecha_completado": null,
  "firmantes": [
    {
      "email": "juan.perez@example.com",
      "estado": "firmado",
      "fecha_firma": "2024-06-09T15:45:32+02:00"
    }
  ],
  "referencia_externa": "CONSULTA-001"
}
```

Estados:

| Estado | Significado |
| --- | --- |
| `pendiente` | Solicitud creada, no iniciada |
| `en_proceso` | Al menos un firmante inicio |
| `completado` | Todos los firmantes firmaron |
| `rechazado` | Solicitud rechazada |

Cuando todos los firmantes completan:

- El contrato pasa a Estado `1`, Subestado `50` (`Firmado`).
- Se envia webhook automatico si esta configurada la notificacion de cambios.
- Se registra evento `process_completed` segun guia.

## Errores

| Codigo | Interpretacion |
| --- | --- |
| `400` | Parametro requerido faltante o invalido |
| `401` | JWT ausente o invalido |
| `403` | Sin permisos sobre `circuito_id` |
| `404` | `circuito_id` no encontrado |
| `500` | Error interno o sistema de firma |

## Persistencia recomendada

Guardar:

- `contrato_id`.
- `request_id`.
- `circuito_id`.
- `canal_envio`.
- `direcciones_firma` parcialmente enmascarado si se loguea.
- `referencia_externa`.
- `estado`.
- `fecha_inicio`, `fecha_completado`.
- `firmantes` y payload bruto.
