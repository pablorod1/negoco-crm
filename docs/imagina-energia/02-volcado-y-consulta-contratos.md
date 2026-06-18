# 02 - Volcado y Consulta de Contratos

## Objetivo

El volcado de contratos se implementa con los endpoints de consulta:

- `GET /contratos`: listado paginado de contratos del canal.
- `GET /contrato/{id_contrato}`: detalle de un contrato concreto.

Ambos requieren JWT y respetan `X-Canal` para impersonacion.
En nuestra integracion, `X-Canal` es obligatorio porque identifica el tenant/canal de Imagina Energia.

## Listado paginado

```http
GET /contratos?pagina=1&por_pagina=100
Authorization: Bearer <token>
X-Canal: <identificador-canal-tenant>
```

Parametros:

| Parametro | Tipo | Default | Limites | Uso |
| --- | --- | --- | --- | --- |
| `pagina` | integer | `1` | minimo `1` | Pagina a recuperar |
| `por_pagina` | integer | `100` | `1..500` | Contratos por pagina |

Respuesta OpenAPI:

```json
{
  "request_id": 158,
  "pagina": 1,
  "num_contratos": 5,
  "contratos": []
}
```

La respuesta no documenta `total` ni `total_pages`. Para volcado completo, iterar paginas hasta que `num_contratos < por_pagina` o `contratos.length === 0`.

## Detalle por ID

```http
GET /contrato/346663
Authorization: Bearer <token>
X-Canal: <identificador-canal-tenant>
```

Reglas:

- `id_contrato` es path parameter integer.
- Solo se pueden consultar contratos del canal indicado en `X-Canal`.
- `404` puede significar no existente o no visible para nuestro canal.

## Modelo de datos relevante

Campos principales de `ContratoInfo`:

| Campo | Uso interno recomendado |
| --- | --- |
| `id` | ID interno de Imagina Energia. Clave externa principal |
| `codigo` | Codigo visible de contrato. Guardar para soporte y UI |
| `alias_externo` | Referencia externa del canal si existe |
| `estado.id`, `estado.descripcion` | Estado funcional actual |
| `subestado.id`, `subestado.descripcion` | Subestado funcional actual |
| `fecha_inicio`, `fecha_fin`, `fecha_firma` | Fechas de ciclo de vida |
| `consumo_anual_estimado` | Consumo anual estimado en Wh segun OpenAPI |
| `atributos.potencia_contratada` | JSON string con potencias por periodo |
| `cliente.identificador` | NIF/NIE/CIF titular |
| `cliente.nombre_completo` | Titular |
| `cliente.correo_electronico`, `cliente.telefono_1` | Contacto |
| `punto_suministro.cups` | CUPS |
| `tarifa_precio.id` | ID de tarifa/precio |
| `tarifa_precio.alias_externo` | Nombre de tarifa |

## Estrategia de volcado

1. Ejecutar `GET /contratos` con `por_pagina=500`.
2. Persistir cada contrato con upsert por `imagina_contract_id`.
3. Guardar `raw_payload` para diagnostico, al menos durante las primeras iteraciones de la integracion.
4. Enriquecer bajo demanda con `GET /contrato/{id_contrato}` si el listado no trae todos los campos necesarios.
5. Registrar `request_id` por pagina para trazabilidad.
6. Aplicar rate limit de lectura: la guia oficial permite hasta 100/min y 500/h para consultas, pero conviene usar lotes moderados.

## Idempotencia

Claves recomendadas:

- `imagina_contract_id`: `ContratoInfo.id`.
- `imagina_contract_code`: `ContratoInfo.codigo`.
- `external_reference`: `alias_externo` o nuestra `referencia_externa` cuando venga por callback.

Para reconciliacion, priorizar `id` sobre `codigo`. El codigo es util para soporte y usuarios, pero el ID es el path parameter de consulta.

## Estados

Los estados y subestados completos estan documentados en [04 - Webhooks, callbacks y estados](04-webhooks-callbacks-y-estados.md). El volcado debe aceptar estados nuevos sin romper: guardar ID y descripcion textual.
