# 09 - Rate Limiting y Operacion

## Limites por defecto

La guia oficial documenta dos niveles.

Limite individual por usuario/IP:

| Ventana | Limite |
| --- | --- |
| Por minuto | 50 peticiones |
| Por hora | 200 peticiones |

Limite global de aplicacion:

| Ventana | Limite |
| --- | --- |
| Por minuto | 1000 peticiones |
| Por hora | 5000 peticiones |

Si se alcanza el limite global, todos los usuarios pueden recibir `429`.

## Limites por endpoint

| Categoria | Endpoints | Limite |
| --- | --- | --- |
| Contratacion | `POST /contrato/residencial/c1`, `POST /contrato/empresa/c1` | 10/min, 50/h |
| Consulta | `GET /contrato/{id_contrato}`, `GET /contratos`, `GET /tarifas` | 100/min, 500/h |
| Documentos | `POST /documento` | 20/min |
| Documentos consulta | `GET /documento/{id}` | 100/min, pero este endpoint no aparece en el YAML actual |

La guia de rate limiting lista endpoints legacy `/c1`. Aplicar los mismos limites conservadores a endpoints universales `/contrato/residencial` y `/contrato/empresa`.

## Headers

Cada respuesta puede incluir:

| Header | Uso |
| --- | --- |
| `X-RateLimit-Limit` | Maximo de peticiones de la ventana |
| `X-RateLimit-Remaining` | Peticiones restantes |
| `X-RateLimit-Reset` | Timestamp Unix de reset |
| `Retry-After` | Segundos a esperar tras `429` |

Ejemplo `429`:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1738598442
Content-Type: application/json
```

```json
{
  "error": "Demasiadas peticiones. Por favor, intenta de nuevo más tarde.",
  "retry_after": "42 seconds"
}
```

## Politica interna de retries

- Respetar `Retry-After` cuando venga.
- Si no viene, usar backoff exponencial con jitter.
- No reintentar automaticamente altas de contrato sin idempotencia interna por `referencia_externa`.
- Para consultas, permitir reintentos seguros.
- Para subida de documentos, reintentar solo si sabemos que el documento no se marco como subido.

## Observabilidad minima

Log estructurado por peticion:

- endpoint y metodo.
- tenant interno.
- canal o permiso `X-Canal`, enmascarado.
- `request_id` de Imagina si existe.
- `referencia_externa`.
- status HTTP.
- duracion.
- `X-RateLimit-Remaining`.
- error normalizado.

Log estructurado por callback:

- tipo de callback.
- tenant.
- `request_id`.
- `referencia_externa`.
- `notification_id`.
- `attempt_number`.
- resultado de validacion HMAC.
- status de procesamiento interno.

## Soporte

Contacto oficial documentado: `serviciosistemas@imaginaenergia.com`.

Incluir siempre:

- `request_id`.
- Fecha/hora UTC.
- Endpoint.
- Canal/tenant.
- Payload sanitizado.
- Resultado de validacion HMAC si aplica.
