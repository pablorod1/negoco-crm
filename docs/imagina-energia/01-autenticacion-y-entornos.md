# 01 - Autenticacion y Entornos

## Hosts

| Uso | Base URL PRE |
| --- | --- |
| Autenticacion | `https://oezimzeqmtmncuipqgwd.supabase.co/functions/v1` |
| API funcional | `https://pre-webhooks.imaginaenergia.com` |
| Swagger | `https://pre-webhooks.imaginaenergia.com/swagger` |
| OpenAPI YAML | `https://pre-webhooks.imaginaenergia.com/api_unificada_limpia.yml` |

La especificacion OpenAPI declara ambos servidores. El endpoint de login fuerza el servidor de Supabase, mientras que el resto de endpoints funcionales usan `pre-webhooks.imaginaenergia.com`.

## Login JWT global de Negoco Cloud

Endpoint:

```http
POST /initiateauthcommand
Host: oezimzeqmtmncuipqgwd.supabase.co
Content-Type: application/json
```

Payload:

```json
{
  "email": "usuario@example.com",
  "password": "secret"
}
```

Respuesta correcta:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

Reglas internas:

- Las credenciales de login son globales de Negoco Cloud para todos los tenants.
- Guardar `IMAGINA_EMAIL` e `IMAGINA_PASSWORD` como variables de entorno, nunca en base de datos tenant.
- Imagina Energia recomendo obtener un JWT en cada llamada para asegurar la autenticacion. Por tanto, el cliente debe autenticarse antes de cada peticion funcional y no depender de cache de token.
- No loguear token, password ni headers completos.
- Tratar `401` como token ausente, invalido o expirado.
- Tratar `403` como permisos insuficientes para la operacion.

## Headers comunes

| Header | Requerido | Uso |
| --- | --- | --- |
| `Authorization: Bearer <token>` | Si | Todos los endpoints protegidos |
| `Content-Type: application/json` | Segun endpoint | Endpoints JSON |
| `X-Canal: <identificador-canal>` | Si para Negoco Cloud | Identificacion del tenant/canal en Imagina Energia |

`X-Canal` identifica el canal de Imagina Energia asociado a cada tenant de Negoco Cloud. Imagina Energia nos proporcionara un identificador por tenant/canal y debemos guardarlo en la tabla tenant `integrations`, en la fila `provider = 'imagina_energia'`.

Aunque la API documenta llamadas sin `X-Canal`, Negoco Cloud no tiene canal predeterminado y no debe llamar nunca sin ese header.

Comportamiento interno:

- Todas las llamadas funcionales deben recibir/resolver tenant.
- El tenant debe tener configurado su identificador de canal Imagina.
- El cliente HTTP debe rechazar la llamada antes de salir a Imagina si falta `X-Canal`.
- Con `X-Canal` invalido o sin permisos, Imagina puede devolver `401` o `403` segun el caso.

## Clave publica RSA

Endpoint:

```http
GET /public_key
Host: pre-webhooks.imaginaenergia.com
```

Respuesta:

```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

Uso previsto: cifrado de informacion sensible antes de enviarla a la API. La guia oficial muestra cifrado RSA con OAEP, MGF1 y SHA-256, codificando el resultado en base64.

Decision interna:

- No asumir que todos los campos sensibles requieren RSA. Revisar con Imagina Energia que campos esperan cifrados antes de aplicar cifrado automatico.
- Cachear la clave publica con TTL corto o recuperarla al arrancar el cliente.

## Errores base

| Codigo | Interpretacion |
| --- | --- |
| `400` | Payload invalido, parametros ausentes o reglas de validacion incumplidas |
| `401` | Token ausente/invalido/expirado o impersonacion no autorizada |
| `403` | Usuario autenticado sin permisos para el recurso |
| `404` | Recurso no encontrado o no visible para el canal |
| `429` | Rate limit |
| `500` | Error interno |
| `504` | Timeout, documentado especialmente en `GET /tarifas` |

## Checklist de cliente HTTP

- Base URLs configurables por entorno.
- Obtencion de JWT por llamada con credenciales globales.
- `X-Canal` obligatorio y resuelto desde configuracion tenant.
- Timeouts explicitos.
- Retries solo para errores transitorios y `429` respetando `Retry-After`.
- Logging con `request_id` y sin secretos.
- Parseo de errores tolerante: el formato de error no es totalmente uniforme entre endpoints.
