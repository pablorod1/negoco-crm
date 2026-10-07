# Migración 025: plantillas de lectura de Excel

Se aplica **solo en la base de control** (`negoco-crm-control`). Es idempotente.

`rate_sheet_recipes` guarda, por comercializadora y forma del libro (nombres
de las hojas), la plantilla con la que se lee su Excel de precios: en qué
hojas, filas y columnas está cada dato. La primera vez la escribe la IA
(~0,01–0,03 $); las siguientes se reutiliza sin llamarla mientras el formato
encaje. Si deja de encajar (cambian títulos, aparecen celdas con error, salen
precios fuera de rango) se pide una nueva y se sustituye.

Sin esta migración la lectura de Excel funciona igual, pero cada subida pide
la plantilla a la IA.

Comprobar con `pnpm comparador:preflight`.
