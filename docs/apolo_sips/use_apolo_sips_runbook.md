# Runbook - uso de `useApoloSips`

## Objetivo

`useApoloSips` permite consultar datos SIPS de Apolo desde componentes cliente sin manejar la API key ni parsear CSV en frontend.

El hook es imperativo: no consulta automaticamente al montar el componente. La UI decide cuando llamar a `fetchPs`, `fetchConsumptions` o `fetchAll`.

## Import

```tsx
import {
  useApoloSips,
  type ApoloSipsSupplyType,
} from "@/integrations/apolo-sips";
```

## API del hook

```ts
const {
  data,
  loading,
  error,
  lastRequest,
  fetchPs,
  fetchConsumptions,
  fetchAll,
  reset,
} = useApoloSips();
```

Estado:

- `data`: ultima respuesta correcta o `null`
- `loading`: `true` mientras hay una consulta en curso
- `error`: mensaje de error o `null`
- `lastRequest`: ultimo payload enviado al endpoint interno

Acciones:

- `fetchPs({ cups, tipoSuministro })`: consulta datos del punto de suministro.
- `fetchConsumptions({ cups, tipoSuministro })`: consulta consumos.
- `fetchAll({ cups, tipoSuministro })`: consulta `PS` y `CONSUMOS` en paralelo.
- `reset()`: limpia estado local del hook.

Todas las acciones devuelven `Promise<ApoloSipsResponseData | null>`.

## Uso recomendado

```tsx
"use client";

import { useState } from "react";
import {
  useApoloSips,
  type ApoloSipsSupplyType,
} from "@/integrations/apolo-sips";

export function SipsLookupExample() {
  const [cups, setCups] = useState("");
  const [tipoSuministro, setTipoSuministro] =
    useState<ApoloSipsSupplyType>("ELECTRICIDAD");

  const { data, loading, error, fetchAll, reset } = useApoloSips();

  const handleSubmit = async () => {
    const result = await fetchAll({ cups, tipoSuministro });

    if (!result) {
      return;
    }

    if (!result.ps?.hasData && !result.consumos?.hasData) {
      // La consulta fue valida, pero Apolo no devolvio filas.
      // La UI puede mostrar un aviso o permitir probar otro tipo de suministro.
    }
  };

  return (
    <div>
      <input value={cups} onChange={(event) => setCups(event.target.value)} />

      <select
        value={tipoSuministro}
        onChange={(event) =>
          setTipoSuministro(event.target.value as ApoloSipsSupplyType)
        }
      >
        <option value="ELECTRICIDAD">Electricidad</option>
        <option value="GAS">Gas</option>
      </select>

      <button type="button" onClick={handleSubmit} disabled={loading}>
        Consultar SIPS
      </button>

      <button type="button" onClick={reset}>
        Limpiar
      </button>

      {error && <p>{error}</p>}
      {data?.ps?.hasData && <p>PS encontrado</p>}
      {data?.consumos?.hasData && <p>Consumos encontrados</p>}
    </div>
  );
}
```

## Elegir el helper correcto

Usa `fetchPs` cuando solo necesitas ficha tecnica del suministro:

```ts
const result = await fetchPs({
  cups: "ES0222120028021251AW",
  tipoSuministro: "GAS",
});
```

Usa `fetchConsumptions` cuando solo necesitas historico de consumos:

```ts
const result = await fetchConsumptions({
  cups: "ES0222120028021251AW",
  tipoSuministro: "GAS",
});
```

Usa `fetchAll` cuando la pantalla necesita ficha y consumos:

```ts
const result = await fetchAll({
  cups: "ES0222120028021251AW",
  tipoSuministro: "GAS",
});
```

## Lectura de resultados

La respuesta discrimina por `tipoSuministro`.

```ts
const result = await fetchAll({
  cups,
  tipoSuministro: "ELECTRICIDAD",
});

if (result?.tipoSuministro === "ELECTRICIDAD") {
  const psRows = result.ps?.rows ?? [];
  const consumptionRows = result.consumos?.rows ?? [];

  const currentTariff = psRows[0]?.codigoTarifaATREnVigor;
  const firstConsumption = consumptionRows[0]?.consumoEnergiaActivaEnWhP1;
}
```

Para gas:

```ts
const result = await fetchAll({
  cups,
  tipoSuministro: "GAS",
});

if (result?.tipoSuministro === "GAS") {
  const psRows = result.ps?.rows ?? [];
  const consumptionRows = result.consumos?.rows ?? [];

  const currentTariff = psRows[0]?.codigoPeajeEnVigor;
  const firstConsumption = consumptionRows[0]?.consumoEnWhP1;
}
```

## Manejo de errores

El hook no muestra toasts. La UI debe decidir como presentar `error`.

Casos habituales:

- `No autorizado`: la sesion no es valida.
- `Payload invalido`: CUPS, tipo de suministro o procedimiento incorrecto.
- `Falta la configuracion de Apolo SIPS`: falta `APOLO_SIPS_API_KEY` en servidor.
- `Apolo SIPS ha rechazado la consulta`: Apolo devolvio error HTTP.
- `Apolo SIPS ha devuelto una respuesta invalida`: la cabecera o CSV no coincide con lo esperado.

`hasData: false` no es error. Significa que Apolo acepto la consulta, pero devolvio solo cabecera CSV.

## Buenas practicas para integrarlo en UI

- Deshabilita el boton de consulta mientras `loading` sea `true`.
- Valida que el usuario haya elegido `ELECTRICIDAD` o `GAS`; no hay autodeteccion.
- Usa `hasData` para distinguir consulta valida sin datos de error real.
- No importes `server.ts`, `schemas.ts`, `csv.ts` ni `normalize.ts` desde componentes cliente.
- Importa desde `@/integrations/apolo-sips` para usar solo el hook y tipos publicos.
- No guardes la respuesta completa en estado global si solo necesitas campos concretos.

## Debug rapido

Para probar el endpoint interno desde el navegador o una accion cliente, usa el hook. Para probar desde terminal durante desarrollo, debe existir una sesion valida si se llama al endpoint del CRM directamente.

El endpoint real de Apolo no debe llamarse desde cliente. La API key vive solo en `process.env.APOLO_SIPS_API_KEY`.
