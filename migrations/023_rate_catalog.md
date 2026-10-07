# Migración 023: catálogo de tarifas

Se aplica **solo en la base de control** (`negoco-crm-control`, variable
`NEXT_TURSO_CONTROL_DB_URL`), no en las bases de tenant. Es idempotente.

- `rate_catalog`: una fila por producto comercial de una comercializadora
  (Quimera «Unicornio», Axpo «1P Plus SSCC Libres»…). Guarda qué es el producto
  —luz o gas, fijo o indexado, tarifas de acceso—, no sus precios: los precios
  son de cada tenant (migración 024). Solo Negoco da de alta o retira tarifas.
- `rate_catalog_aliases`: otros nombres con los que el producto aparece en los
  anexos, para que la ingesta lo reconozca aunque cambie la forma de escribirlo.

La comercializadora se identifica por su nombre normalizado (`supplier_key`) y,
si existe, por su id en el maestro del backoffice. No se usa el `COM-xxx`,
porque cada tenant tiene los suyos. La normalización es la del sincronizador de
comercializadoras del backoffice: sin acentos, sin signos y en minúsculas.

Comprobar el resultado con `pnpm comparador:preflight`.
