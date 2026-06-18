# 05 - Scoring y Credit Check

## Situacion documental

Hay una divergencia importante:

- El YAML OpenAPI solo declara `POST /creditcheck` como proceso sincrono con respuesta `200`.
- La guia oficial HTML actual declara el credit check como estrictamente asincrono, con `callback_url` obligatorio.
- La guia HTML anade endpoints que no estan en el YAML: `/creditcheck_gas`, `/creditcheck_no_sips` y `/creditcheck_no_sips_gas`.

Decision interna: para implementacion funcional, priorizar la guia HTML actual y modelar scoring como asincrono.

## Endpoints

| Endpoint | Producto | Modalidad | Estado |
| --- | --- | --- | --- |
| `POST /creditcheck` | Electricidad | Con SIPS | OpenAPI + guia |
| `POST /creditcheck_gas` | Gas | Con SIPS | Solo guia HTML |
| `POST /creditcheck_no_sips` | Electricidad | Amount directo | Solo guia HTML |
| `POST /creditcheck_no_sips_gas` | Gas | Amount directo | Solo guia HTML |

## Electricidad con SIPS

Endpoint: `POST /creditcheck`.

Persona fisica/autonomo:

| Campo | Regla |
| --- | --- |
| `company_name` | Nombre completo |
| `identificador` | NIF/NIE |
| `tipo_identificador` | `NIF` segun guia |
| `tipo_persona` | `Física` |
| `autonomo` | boolean |
| `postal_code`, `town`, `address`, `province` | Obligatorios segun guia |
| `cups` | CUPS electricidad |
| `callback_url` | Obligatorio segun guia |
| `cae`, `tarifa_json`, `referencia_externa` | Opcionales |

Persona juridica:

| Campo | Regla |
| --- | --- |
| `company_name` | Razon social |
| `identificador` | CIF/NIF empresa |
| `tipo_identificador` | La guia recomienda `NIF` incluso para CIF |
| `tipo_persona` | `Jurídica` |
| `autonomo` | `false` |
| `postal_code` | Obligatorio |
| `cups` | CUPS electricidad |
| `callback_url` | Obligatorio segun guia |
| `town`, `address`, `province`, `referencia_externa` | Opcionales |

## Gas con SIPS

Endpoint: `POST /creditcheck_gas`.

La guia indica el mismo modelo que electricidad, usando CUPS gas. `cae` es opcional y recomendado porque permite scoring directo sin depender por completo de SIPS.

Campos opcionales adicionales:

- `cae`: consumo anual estimado.
- `tarifa_json`: por ejemplo `{ "nombre": "RL.3" }`.
- `referencia_externa`.

## Endpoints sin SIPS

Usar cuando ya tenemos el importe calculado y no queremos que Imagina consulte SIPS.

Reglas:

| Campo | Regla |
| --- | --- |
| `amount` | Obligatorio, numerico, mayor que 0 |
| `cups` | Prohibido. Debe provocar `400` si se envia |
| `cae` | Prohibido. Debe provocar `400` si se envia |
| `identificador` | Obligatorio |
| `tipo_identificador` | Obligatorio |
| `callback_url` | Opcional en texto de no-SIPS, pero recomendable para unificar flujo asincrono |
| `tipo_persona` | Opcional, auto-detectable segun guia |
| `referencia_externa` | Recomendable |

Errores documentados:

- Si se envia `cups`: `"El parámetro 'cups' no está permitido en /creditcheck_no_sips"`.
- Si se envia `cae`: `"El parámetro 'cae' no está permitido en /creditcheck_no_sips"`.
- Si falta `amount`: `"El parámetro 'amount' es requerido para /creditcheck_no_sips"`.
- Si `amount <= 0`: `"El parámetro 'amount' debe ser un número válido mayor que 0"`.

## Respuesta inicial asincrona

La guia resume el flujo como:

1. Enviamos JSON.
2. Recibimos `202 Accepted` con `request_id`.
3. Imagina procesa SIPS, Experian/Indika y reglas internas.
4. Recibimos callback con resultado final.

Aunque el YAML actual no modela ese `202`, nuestra integracion debe persistir `request_id`.

## Callback de scoring

Estructura actual segun guia:

```json
{
  "request_id": 1542,
  "referencia_externa": "SOLICITUD-99",
  "result": {
    "amount": 2500.50,
    "codigo": 1,
    "texto": "Aprobado",
    "raw": {}
  },
  "_callback_signature": {
    "version": "v1",
    "signature": "...",
    "timestamp": "1772552356"
  }
}
```

Valores:

| Codigo | Texto | Accion recomendada |
| --- | --- | --- |
| `1` | Aprobado | Continuar contratacion |
| `2` | Revision Manual | Mantener en flujo operativo y revisar manualmente, no mapear automaticamente a `Scoring` |
| `3` | Denegado | Mapear a estado Negoco `Scoring` |
| `4` | Revision Manual | Tratar como revision por error o timeout, no mapear automaticamente a `Scoring` |

En errores puede venir:

```json
{
  "request_id": 1543,
  "referencia_externa": "SOLICITUD-100",
  "result": {
    "amount": 1500.00,
    "codigo": 4,
    "texto": "Revisión Manual",
    "error": "No se ha podido verificar el scoring, se hace por revisión manual, puede continuar con la contratación."
  }
}
```

## Scoring dentro de contratacion

El alta de contrato tambien ejecuta scoring salvo que se envie `no_credit_check: true`.

En el callback de contratacion, `credit_result` puede incluir:

- `status_code`.
- `result_operation`: `Aprobado`, `Revisión Manual` o `Denegado`.
- `result_code`: `1` aprobado, `2/4` revision manual, `3` denegado.
- `raw`: respuesta completa del proveedor.

## Semantica del estado `Scoring` en Negoco

En Negoco CRM, `Scoring` no significa "evaluacion en curso". Significa que el CUPS o la operacion ha sido denegada por impagos, riesgo u otro motivo externo de la compania.

Por tanto:

- Mientras Imagina esta procesando el alta o el credit check, no debemos mover automaticamente el tramite a `Scoring`.
- Si el scoring queda aprobado, el flujo continua hacia alta/firma.
- Si Imagina devuelve revision manual, debemos registrar el resultado y decidir si lo tratamos como `Incidencia` o lo dejamos en el estado operativo anterior con una tarea/nota interna, segun producto.
- Si Imagina devuelve denegado (`result_code = 3` o equivalente), entonces si pasamos el tramite a `Scoring`.

## Persistencia recomendada

Guardar por cada scoring:

- `request_id`.
- `referencia_externa`.
- Endpoint usado.
- Producto: luz/gas.
- Modalidad: SIPS/no-SIPS.
- `identificador` normalizado.
- `amount` evaluado si existe.
- `codigo`, `texto`, `error`.
- `raw`.
- Payload firmado recibido y estado de validacion HMAC.
