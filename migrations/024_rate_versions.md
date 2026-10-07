# Migración 024: versiones de precios, ingestas y comisiones

Se aplica en **cada base de tenant** (test, beenergy, nasertel y eficience).
Requiere antes la 023 en la base de control.

## Qué crea

- `comercializadora_rate_versions`: los precios de una comercializadora que
  entran en vigor juntos. Borrador, programada, activa, sustituida o
  descartada. Un índice único impide dos versiones activas de la misma
  comercializadora.
- `comercializadora_rate_prices`: una fila por tarifa y combinación de
  condiciones (nivel, territorio, banda de potencia o consumo, canal, mes de
  inicio, duración). Los precios van en las unidades del motor (€/kW·día y
  €/kWh) y el valor original del anexo queda en `source_values`. Un CHECK
  rechaza la energía a cero en P1–P3: un producto de precio único lleva el
  mismo precio en los tres periodos.
- `rate_ingests`: cada documento recibido y el resultado de clasificarlo,
  extraerlo y validarlo.
- `rate_commission_rules`: comisión de la agencia por tarifa, nivel y tramo de
  consumo, con vigencia.
- `comercializadora_rates.catalog_rate_id`: enlace de cada tarifa del tenant
  con el catálogo. `comercializadora_rates` sigue siendo la lista de tarifas
  del tenant que usan los contratos (`contracts.rate_id` en la integración de
  Imagina).

## Cómo aplicarla

Por cada tenant, en este orden:

1. `024_rate_versions.sql`. Es idempotente.
2. `024_rate_versions_columns.sql`, **una sola vez**. Antes, comprobar con
   `PRAGMA table_info(comercializadora_rates);` que `catalog_rate_id` no existe.
3. Solo en beenergy, nasertel y eficience, que no tienen la migración de
   Imagina:

   ```sql
   ALTER TABLE comercializadora_rates ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
   ```

   Es la misma definición que añade la integración de Imagina (rama
   `imagina-integration`, `docs/migrations/009`). Test ya la tiene. Cuando se
   aplique la 009 en estos tenants, hay que saltarse esa línea.

Después, `pnpm comparador:preflight` debe mostrar las cinco tablas en los
cuatro tenants y las columnas `catalog_rate_id` y `enabled` en
`comercializadora_rates`.

Sin la migración, el resto del CRM funciona igual: solo la usan las rutas y la
vista «Tarifas» del comparador, ocultas tras el módulo `negoco_studies`.
