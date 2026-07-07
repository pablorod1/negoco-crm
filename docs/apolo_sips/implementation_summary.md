# Integracion Apolo SIPS - resumen tecnico

## Estado actual

La integracion esta implementada como una capa interna del CRM para consultar la API SIPS de Apolo sin exponer la `APOLO_SIPS_API_KEY` al navegador.

Piezas principales:

- Modulo compartido: `src/integrations/apolo-sips`
- Endpoint interno: `POST /api/v2/integrations/apolo-sips`
- Hook cliente: `useApoloSips`
- Tests: parser CSV y endpoint interno con mocks

No se persisten datos SIPS en base de datos y no hay integracion visual todavia.

## Contrato interno

El endpoint recibe:

```json
{
  "cups": "ES0222120028021251AW",
  "tipoSuministro": "GAS",
  "procedimientos": ["PS", "CONSUMOS"]
}
```

Valores validos:

- `tipoSuministro`: `ELECTRICIDAD` o `GAS`
- `procedimientos`: `PS`, `CONSUMOS` o ambos

La respuesta de exito tiene esta forma:

```json
{
  "success": true,
  "data": {
    "cups": "ES0222120028021251AW",
    "tipoSuministro": "GAS",
    "ps": {
      "procedure": "PS",
      "supplyType": "GAS",
      "columns": [],
      "rows": [],
      "rowCount": 0,
      "hasData": false
    },
    "consumos": {
      "procedure": "CONSUMOS",
      "supplyType": "GAS",
      "columns": [],
      "rows": [],
      "rowCount": 0,
      "hasData": false
    }
  }
}
```

`rows` contiene objetos tipados segun la combinacion real:

- `PS + ELECTRICIDAD`
- `CONSUMOS + ELECTRICIDAD`
- `PS + GAS`
- `CONSUMOS + GAS`

Si Apolo devuelve solo cabecera CSV, el CRM responde `success: true`, `rows: []`, `rowCount: 0` y `hasData: false`.

## Implementacion

El endpoint valida sesion con `validateUserSession`. Cualquier usuario autenticado puede consultar SIPS.

Flujo:

1. Valida JSON y payload con Zod.
2. Normaliza el CUPS eliminando espacios, guiones, puntos y guiones bajos.
3. Lee `APOLO_SIPS_API_KEY` desde variables de entorno solo en servidor.
4. Llama a Apolo con el formato esperado por su API:

```json
{
  "Procedimiento": "CONSUMOS",
  "TipoSuministro": "GAS",
  "CUPS": "ES0222120028021251AW"
}
```

5. Si se piden `PS` y `CONSUMOS`, ejecuta ambas llamadas en paralelo.
6. Parsea la respuesta `text/plain` como CSV.
7. Valida que la cabecera contenga las columnas esperadas.
8. Normaliza filas:
   - celdas vacias a `null`
   - consumos, potencias, caudales, importes y porcentajes a `number | null`
   - fechas, codigos y textos a `string | null`

Errores esperados:

- `400`: JSON o payload invalido
- `401`: usuario sin sesion
- `500`: falta `APOLO_SIPS_API_KEY`
- `502`: error de red, rechazo upstream o respuesta invalida de Apolo

## Tests y validacion

Pruebas implementadas:

- Parser CSV con cabecera sin filas.
- Parser CSV con valores entrecomillados y comas.
- Normalizacion de valores vacios y numericos.
- Endpoint sin sesion.
- Endpoint con payload invalido.
- Endpoint con respuesta solo cabecera.
- Endpoint llamando `PS` y `CONSUMOS` en paralelo.
- Comprobacion de que la API key no aparece en la respuesta.

Comandos ejecutados:

```bash
bun test src/integrations/apolo-sips/csv.test.js src/app/api/v2/integrations/apolo-sips/route.test.js
bun run type-check
```

Ambos pasan.

## Pasos pendientes

- Integrar el hook en la pantalla o flujo del CRM donde se vaya a consultar SIPS.
- Definir la UX para elegir `tipoSuministro`; actualmente debe indicarse siempre de forma explicita.
- Decidir que hacer cuando `hasData` sea `false`: mostrar aviso, permitir probar otro suministro manualmente o bloquear el flujo.
- Mapear los campos SIPS que interesen al modelo de negocio del CRM, por ejemplo direccion, tarifa, potencias o historico de consumos.
- Definir si en una fase posterior se guardaran snapshots SIPS en base de datos para auditoria.
- Anadir observabilidad si la integracion pasa a ser critica: logs agregados por status upstream, tiempos de respuesta y ratio de consultas sin datos.
