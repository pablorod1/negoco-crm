# 11 - Referencia y Discrepancias

## Fuentes revisadas

| Fuente | URL |
| --- | --- |
| Portada oficial | https://pre-webhooks.imaginaenergia.com/ |
| Swagger | https://pre-webhooks.imaginaenergia.com/swagger |
| OpenAPI YAML | https://pre-webhooks.imaginaenergia.com/api_unificada_limpia.yml |
| Proceso de contratacion | https://pre-webhooks.imaginaenergia.com/proceso_contratacion.html |
| Autenticacion | https://pre-webhooks.imaginaenergia.com/autentificacion.html |
| Clave publica RSA | https://pre-webhooks.imaginaenergia.com/rsa_key.html |
| Consulta de tarifas | https://pre-webhooks.imaginaenergia.com/consulta_tarifas.html |
| Firma digital | https://pre-webhooks.imaginaenergia.com/gestion_firma.html |
| Credit check asincrono | https://pre-webhooks.imaginaenergia.com/gui_creditcheck_asincrono.html |
| Fees y margenes | https://pre-webhooks.imaginaenergia.com/fees_margenes_guia.html |
| Seguridad de callbacks | https://pre-webhooks.imaginaenergia.com/seguridad_callbacks.html |
| Notificaciones de cambios | https://pre-webhooks.imaginaenergia.com/notificaciones_cambios.html |
| Rate limiting | https://pre-webhooks.imaginaenergia.com/rate_limiting.html |
| Municipios enum | https://pre-webhooks.imaginaenergia.com/municipios.enum.yml |

## Metadatos OpenAPI

| Campo | Valor |
| --- | --- |
| `openapi` | `3.0.3` |
| `info.title` | `API Completa - Contratos, Documentos y Autenticación` |
| `info.version` | `1.2.0` |
| Contacto | `serviciosistemas@imaginaenergia.com` |
| Numero de paths en YAML | 15 |
| Hash SHA-256 local/oficial | Coincidente el 2026-06-17 |

Servers:

- `https://oezimzeqmtmncuipqgwd.supabase.co/functions/v1` - PRE auth.
- `https://pre-webhooks.imaginaenergia.com` - PRE API.

## Matriz de endpoints OpenAPI

| Metodo | Path | Operation ID | Notas |
| --- | --- | --- | --- |
| `POST` | `/initiateauthcommand` | no definido | Login JWT, sin `BearerAuth` |
| `GET` | `/public_key` | `getPublicKey` | Clave publica RSA, sin `BearerAuth` |
| `GET` | `/contrato/{id_contrato}` | `getContrato` | Detalle por ID |
| `GET` | `/contratos` | `listarContratos` | Paginado por `pagina`, `por_pagina` |
| `POST` | `/contrato/empresa` | `postContratoEmpresa` | Universal C1/C2/A3 |
| `POST` | `/contrato/empresa/c1` | `postContratoEmpresaC1` | Legacy |
| `POST` | `/contrato/residencial` | `postContratoResidencial` | Universal C1/C2/A3 |
| `POST` | `/contrato/residencial/c1` | `postContratoResidencialC1` | Legacy |
| `POST` | `/documento` | `uploadDocumento` | Multipart |
| `GET` | `/tarifas` | `getTarifas` | Sincrono |
| `POST` | `/creditcheck` | `postCreditCheck` | YAML lo marca sincrono; guia lo marca asincrono |
| `POST` | `/firma` | `postFirma` | Envio inicial a firma |
| `POST` | `/firma/reenviar` | `postReenviarFirma` | Reenvio |
| `GET` | `/firma/{circuito_id}` | `getEstadoFirma` | Estado de firma |
| `GET` | `/firma-health` | `getFirmaHealth` | Health check |

## Schemas OpenAPI

| Schema | Uso |
| --- | --- |
| `ErrorResponse` | Error generico |
| `Tarifa` | Item de `GET /tarifas` |
| `ListaContratosResponse` | Respuesta de `GET /contratos` |
| `ContratoInfo` | Contrato en listado/detalle |
| `ContratoResidencialRequest` | Alta residencial |
| `ContratoEmpresaRequest` | Alta empresa |
| `ContratoResidencialResponseSuccess` | Respuesta/callback de alta residencial |
| `ContratoEmpresaResponseSuccess` | Respuesta/callback de alta empresa |
| `CreditResult` | Resultado legacy de scoring en callback de contratacion |
| `ContratoResult` | Resultado de alta |
| `FirmaResult` | Resultado de envio a firma |
| `Provincia` | Enum de provincias |
| `Municipio` | String, catalogo completo externo |
| `TipoViaCnmc` | Enum ATR 12 |
| `TipoAutoconsumoCnmc` | Enum ATR 113 |

## Discrepancias y decisiones

### 1. Version de OpenAPI frente a changelog

El YAML declara `info.version: 1.2.0`, pero la portada documenta cambios hasta `v2.4` el 9 de junio de 2026. La spec publicada parece no haber actualizado su version semantica.

Decision: no usar `info.version` como indicador unico de capacidades.

### 2. Scoring asincrono

El YAML describe `POST /creditcheck` como sincrono, sin `callback_url` y con respuesta `{ result, score, message }`.

La guia HTML declara que el credit check es estrictamente asincrono, con callback obligatorio para modalidad con SIPS, y callback con `result.codigo`, `result.texto`, `result.amount` y `raw`.

Decision: implementar scoring como asincrono y aceptar que el schema OpenAPI esta desfasado.

### 3. Endpoints de scoring no presentes en YAML

La guia documenta:

- `POST /creditcheck_gas`
- `POST /creditcheck_no_sips`
- `POST /creditcheck_no_sips_gas`

No aparecen en el YAML.

Decision: incluirlos en nuestro cliente como endpoints soportados por guia, detras de feature flag o cobertura de tests de contrato en PRE.

### 4. Notificaciones de cambios no modeladas en YAML

La guia indica usar `url_notificaciones_cambios_contrato` al crear contrato. Este campo no esta en `ContratoResidencialRequest` ni `ContratoEmpresaRequest`.

Decision: permitir este campo en nuestros mappers como extension documentada.

### 5. Fees y margenes no modelados en YAML de request

La guia documenta `margenes_tarifa_precios`, pero los schemas de contrato no lo incluyen.

Decision: soportarlo como extension documentada y validarlo localmente con los limites de `GET /tarifas`.

### 6. `years_vigencia`

El changelog y la guia de contratacion mencionan `years_vigencia`, con default 1. No aparece en los schemas de contrato.

Decision: no enviarlo por defecto. Anadirlo solo si Imagina confirma que esta activo para nuestro canal.

### 7. Documento `DNI`

La guia usa `DNI` como ejemplo de tipo documental, pero el enum OpenAPI no contiene `DNI`. Contiene `Identificador Cliente`.

Decision: mapear documentos de identidad a `Identificador Cliente` salvo confirmacion de soporte.

### 8. `GET /documento/{id}`

La guia de rate limiting lo menciona, pero el YAML no lo define.

Decision: no implementarlo hasta confirmacion o prueba PRE.

### 9. Unidades de fees

La guia HTML habla de `fee_energia` y `fee_autoconsumo` en euros/MWh. El YAML describe algunos campos como euros/kWh.

Decision: confirmar unidad con Imagina antes de mostrar valores en UI o calcular importes. Para validacion de rango, comparar contra los valores devueltos por `GET /tarifas` sin convertir unidades.

## Preguntas abiertas para Imagina Energia

1. Confirmar si `callback_url` es obligatorio en `POST /creditcheck` y en los endpoints no-SIPS.
2. Confirmar disponibilidad en PRE y PROD de `/creditcheck_gas`, `/creditcheck_no_sips` y `/creditcheck_no_sips_gas`.
3. Confirmar si `url_notificaciones_cambios_contrato`, `margenes_tarifa_precios` y `years_vigencia` estan aceptados aunque no aparezcan en OpenAPI.
4. Confirmar unidades definitivas de `fee_energia` y `fee_autoconsumo`.
5. Confirmar catalogo documental esperado para DNI/NIE/CIF.
6. Decision interna: las URLs de callback y notificaciones usaran subdominio de tenant (`https://{tenant-subdomain}.{app-domain}/...`) para resolver el branch/base Turso correcto. Validar en PRE que Imagina firma y reintenta correctamente con esos hosts publicos.
