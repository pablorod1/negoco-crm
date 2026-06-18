# 06 - Tarifas, Fees y Margenes

## Consulta de tarifas

Endpoint:

```http
GET /tarifas
Authorization: Bearer <token>
X-Canal: <identificador-canal-tenant>
```

Caracteristicas documentadas:

- Sincrono.
- Sin body.
- Requiere `X-Canal` en nuestra integracion para identificar el tenant.
- Devuelve `request_id` para auditoria.
- Puede devolver `504` por timeout.

Respuesta:

```json
{
  "content": [
    {
      "id_tarifa_precios": 11001,
      "alias_externo": "REGANTES - FLEX INDEX 2.0TD",
      "descripcion": "2.0TD",
      "codigo_atr": "018",
      "tipo_tarifa_precio": "indexado",
      "precio_potencia_boe": "S"
    }
  ],
  "request_id": 18
}
```

Usar `id_tarifa_precios` como `id_tarifa` en altas de contrato.

## Tipos de tarifa

| Tipo | Regla |
| --- | --- |
| `indexado` | Los campos `energia_pX_formula` pueden ser `null` porque el precio varia por mercado |
| `fijo` | `energia_pX_formula` tiene valores numericos como string |

Periodos: P1..P6. No todos aplican a todas las tarifas.

## Campos principales de tarifa

| Campo | Uso |
| --- | --- |
| `id_tarifa_precios` | Identificador de precio/tarifa |
| `alias_externo` | Nombre comercial visible |
| `nombre` | Nombre oficial o interno |
| `descripcion` | Tarifa de acceso, por ejemplo `2.0TD` |
| `codigo_atr` | Codigo ATR oficial |
| `tipo_tarifa_precio` | `indexado` o `fijo` |
| `precio_potencia_boe` | `S` si potencia BOE, `N` si precio especial |
| `precio_excedentes` | Precio de excedentes autoconsumo |
| `potencia_p1_formula..potencia_p6_formula` | Potencia por periodo en euros/kW/ano |
| `energia_p1_formula..energia_p6_formula` | Energia por periodo en euros/kWh |

## Limites de fees

La respuesta de `GET /tarifas` incluye limites para validar margenes antes de contratar.

Conceptos soportados:

| Concepto | Unidad | Periodos |
| --- | --- | --- |
| `precio_potencia` | euros/kW/ano | P1..P6 |
| `fee_energia` | euros/MWh segun guia HTML, euros/kWh segun descripciones de OpenAPI | P1..P6 |
| `fee_autoconsumo` | euros/MWh segun guia HTML, euros/kWh segun OpenAPI | P1..P6 |

Campos de limites siguen este patron:

- `valor_p1_min_precio_potencia`
- `valor_p1_max_precio_potencia`
- `valor_p1_min_fee_energia`
- `valor_p1_max_fee_energia`
- `valor_p1_min_fee_autoconsumo`
- `valor_p1_max_fee_autoconsumo`

Y asi para `p1..p6`.

Caso especial: si minimo y maximo son `"0"` o `"0.0"`, no se debe aplicar fee para ese concepto/periodo.

## Envio de margenes en contratacion

La guia recomienda `margenes_tarifa_precios`:

```json
{
  "id_tarifa": 11539,
  "margenes_tarifa_precios": {
    "precio_potencia": {
      "periodos_concepto": {
        "p1": { "valor": 25.0 },
        "p2": { "valor": 22.0 }
      }
    },
    "fee_energia": {
      "periodos_concepto": {
        "p1": { "valor": 0.05 },
        "p2": { "valor": 0.04 }
      }
    }
  }
}
```

Notas:

- No es obligatorio enviar todos los periodos.
- Los periodos omitidos no tienen fee aplicado.
- Se puede enviar solo `precio_potencia` o solo `fee_energia`.
- La guia dice que tambien se soportan fees planos en la raiz del request, pero debemos usar el objeto estructurado.
- `margenes_tarifa_precios` no aparece en el schema OpenAPI actual. Tratarlo como extension documentada por guia HTML.

## Validacion en API

La guia describe dos fases:

1. Validacion de `id_tarifa`: se ejecuta siempre.
2. Validacion de rangos: solo si se envia `margenes_tarifa_precios`.

Errores representativos:

```json
{
  "error": "Errores en validación de rangos de fees:\n  - Tarifa 11539, precio_potencia.p1: valor 100.0 excede el máximo permitido 50.0"
}
```

## Estrategia interna

1. Sincronizar `GET /tarifas` por tenant/canal y guardar el catalogo en `comercializadora_rates` para la comercializadora Imagina Energia del tenant.
2. Usar `id_tarifa_precios` como identificador externo que se enviara en el alta como `id_tarifa`.
3. Cachear tarifas con TTL conservador. La guia recomienda no cachear por periodos largos.
4. Validar localmente los fees contra limites para evitar rechazos.
5. Guardar snapshot de tarifa y limites usados en cada contrato.
6. Registrar `request_id` de la consulta/sincronizacion de tarifas en el intento de contratacion.

## Persistencia en `comercializadora_rates`

La base ya tiene la tabla `comercializadora_rates`, pero el modelo actual es generico y minimo:

- `id`
- `name`
- `price`
- `type`
- `comercializadora_id`
- timestamps

Para Imagina Energia necesitamos poder persistir el identificador externo y el payload de tarifa que devuelve la API. Recomendacion de ampliacion:

| Columna | Uso |
| --- | --- |
| `provider` | `imagina_energia`, para distinguir futuras integraciones |
| `external_rate_id` | `id_tarifa_precios` de Imagina. Es el valor que enviamos como `id_tarifa` |
| `alias_externo` | Nombre comercial devuelto por Imagina |
| `codigo_atr` | Codigo ATR oficial |
| `descripcion` | Tarifa de acceso, por ejemplo `2.0TD` |
| `raw` | JSON completo de la tarifa, incluidos precios y limites |
| `synced_at` | Fecha de ultima sincronizacion |
| `enabled` | Permite ocultar/desactivar tarifas sin borrarlas |

Indice recomendado:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_comercializadora_rates_provider_external
ON comercializadora_rates(comercializadora_id, provider, external_rate_id);
```

El mapper de alta no debe depender de tarifas hardcodeadas ni de nombres comerciales. Debe seleccionar una fila de `comercializadora_rates` asociada a Imagina Energia y enviar `external_rate_id` como `id_tarifa`.

Si el contrato no tiene tarifa seleccionada, el endpoint de envio a Imagina debe bloquear el alta y devolver un error accionable para que el usuario seleccione/sincronice tarifa antes de enviar.
