# Imagina Energia - Documentacion Interna

Fecha de analisis: 2026-06-17.

Esta carpeta documenta la integracion completa con la API de Imagina Energia a partir de tres fuentes:

- OpenAPI local: [`api_unificada_limpia.yml`](api_unificada_limpia.yml).
- Swagger oficial: https://pre-webhooks.imaginaenergia.com/swagger.
- Documentacion HTML oficial: https://pre-webhooks.imaginaenergia.com/.

La copia local del YAML coincide con la copia publicada por Imagina Energia en `https://pre-webhooks.imaginaenergia.com/api_unificada_limpia.yml` en la fecha de analisis.

## Indice

- [01 - Autenticacion y entornos](01-autenticacion-y-entornos.md)
- [02 - Volcado y consulta de contratos](02-volcado-y-consulta-contratos.md)
- [03 - Alta de contratos](03-alta-contratos.md)
- [04 - Webhooks, callbacks y estados](04-webhooks-callbacks-y-estados.md)
- [05 - Scoring y credit check](05-scoring.md)
- [06 - Tarifas, fees y margenes](06-tarifas-fees-y-margenes.md)
- [07 - Firma digital](07-firma-digital.md)
- [08 - Documentos](08-documentos.md)
- [09 - Rate limiting y operacion](09-rate-limiting-y-operacion.md)
- [10 - Plan de implementacion](10-plan-implementacion.md)
- [11 - Referencia y discrepancias](11-referencia-y-discrepancias.md)

## Cobertura de la API

| Area | Endpoints | Estado documental |
| --- | --- | --- |
| Autenticacion | `POST /initiateauthcommand` | OpenAPI + guia HTML |
| Seguridad RSA | `GET /public_key` | OpenAPI + guia HTML |
| Volcado de contratos | `GET /contratos`, `GET /contrato/{id_contrato}` | OpenAPI + portada |
| Alta residencial | `POST /contrato/residencial`, `POST /contrato/residencial/c1` | OpenAPI + guia de contratacion |
| Alta empresa | `POST /contrato/empresa`, `POST /contrato/empresa/c1` | OpenAPI + guia de contratacion |
| Documentos | `POST /documento` | OpenAPI + guia de contratacion |
| Tarifas | `GET /tarifas` | OpenAPI + guia HTML |
| Fees y margenes | `margenes_tarifa_precios` en altas | Guia HTML, no modelado en OpenAPI |
| Scoring luz | `POST /creditcheck` | OpenAPI desactualizado respecto a guia HTML |
| Scoring gas | `POST /creditcheck_gas` | Guia HTML, no aparece en OpenAPI |
| Scoring sin SIPS | `POST /creditcheck_no_sips`, `POST /creditcheck_no_sips_gas` | Guia HTML, no aparece en OpenAPI |
| Firma digital | `POST /firma`, `POST /firma/reenviar`, `GET /firma/{circuito_id}`, `GET /firma-health` | OpenAPI + guia HTML |
| Actualizacion de estados | `url_notificaciones_cambios_contrato` + webhook entrante | Guia HTML, no modelado en OpenAPI |
| Rate limiting | Headers `X-RateLimit-*`, `Retry-After` | Guia HTML |

## Decisiones de integracion

1. Priorizar los endpoints universales `POST /contrato/residencial` y `POST /contrato/empresa`. Los endpoints `/c1` se mantienen por compatibilidad.
2. Tratar altas de contrato y scoring como flujos asincronos cuando la guia HTML lo indique, aunque el YAML de scoring todavia describa una respuesta sincrona.
3. Guardar siempre `request_id`, `referencia_externa`, `contrato_id`, `codigo_contrato`, `circuito_id` y payload bruto de callbacks para trazabilidad.
4. Validar todos los callbacks y webhooks con HMAC-SHA256 antes de procesarlos.
5. Usar `url_notificaciones_cambios_contrato` para actualizacion de estados y evitar polling agresivo.
6. Consultar `GET /tarifas` antes de contratar para validar `id_tarifa` y rangos de fees.
7. Resolver municipios contra el recurso oficial `municipios.enum.yml`, publicado en https://pre-webhooks.imaginaenergia.com/municipios.enum.yml.
8. Obtener un JWT global de Negoco Cloud en cada llamada a Imagina Energia, siguiendo la recomendacion recibida, y enviar siempre `X-Canal` con el identificador del tenant.

## Configuracion esperada

| Variable | Uso |
| --- | --- |
| `IMAGINA_AUTH_BASE_URL_PRE` | Auth PRE. Obligatoria en desarrollo local y Vercel preview |
| `IMAGINA_API_BASE_URL_PRE` | API PRE. Obligatoria en desarrollo local y Vercel preview |
| `IMAGINA_AUTH_BASE_URL_PROD` | Auth PROD. Obligatoria cuando `NODE_ENV=production` o `VERCEL_ENV=production` |
| `IMAGINA_API_BASE_URL_PROD` | API PROD. Obligatoria cuando `NODE_ENV=production` o `VERCEL_ENV=production` |
| `IMAGINA_EMAIL` | Usuario global de Negoco Cloud para obtener JWT |
| `IMAGINA_PASSWORD` | Password global de Negoco Cloud para obtener JWT |
| `IMAGINA_CALLBACK_SEED_KEY` | Clave compartida para validar HMAC de callbacks |
| `IMAGINA_WEBHOOK_PUBLIC_ROOT_DOMAIN` | Dominio raiz publico para construir callbacks por tenant |

Seleccion de entorno:

- Desarrollo local y Vercel preview usan siempre PRE, leyendo solo `IMAGINA_AUTH_BASE_URL_PRE` e `IMAGINA_API_BASE_URL_PRE`.
- Produccion usa solo `IMAGINA_AUTH_BASE_URL_PROD` e `IMAGINA_API_BASE_URL_PROD`.
- No hay URLs hardcodeadas, fallback entre PRE y PROD ni override manual de entorno: si falta la URL del entorno runtime, no se inicia la conexion con Imagina Energia.

El identificador `X-Canal` no es una variable global: es dato de configuracion de cada tenant/canal y debe persistirse asociado al tenant correspondiente.

Las URLs de callback que enviamos a Imagina Energia deben construirse con el subdominio publico de cada tenant, no con un host global compartido. Esto permite resolver el branch/base Turso correcto al recibir la notificacion y ademas es necesario para validar HMAC, porque la URL exacta forma parte del mensaje firmado.

Ejemplo:

- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratacion`
- `https://{tenant-subdomain}.{app-domain}/api/webhooks/imagina-energia/contratos`

## Flujo principal recomendado

1. Crear el tramite y sus contratos solo en Negoco CRM.
2. Cuando el usuario cambie el tramite a `Verificado` desde `UpdateTramiteStatusModal.tsx`, permitir opcionalmente enviar el alta a Imagina Energia si la comercializadora destino resuelve por nombre a `Imagina Energía` y el tenant tiene `X-Canal` configurado.
3. Autenticarse contra Imagina Energia para obtener un JWT nuevo para esa llamada.
4. Consultar tarifas disponibles del canal si hacen falta datos actualizados de tarifa/fees.
5. Crear contrato con `callback_url`, `referencia_externa` y `url_notificaciones_cambios_contrato`, usando siempre URLs con subdominio de tenant.
6. Recibir callback de contratacion, validar firma, persistir resultado y subir documentos.
7. Gestionar firma digital si no se envio dentro del alta o si hay que reenviarla.
8. Recibir notificaciones de cambios para actualizar estados internos.
