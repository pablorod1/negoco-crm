# Migración 028: datos del cliente en el estudio

Se aplica **en la base de cada tenant** con el módulo del comparador, después
de la 026. **No es idempotente** (SQLite no admite `ADD COLUMN IF NOT
EXISTS`): antes, comprobar con `PRAGMA table_info(comparison_studies)` que
`client_data` no existe.

Al completar un estudio, el diálogo pide los datos del cliente, todos
opcionales: nombre, tipo, DNI o CIF, correo, teléfono, IBAN y dirección del
suministro (código postal, población y provincia vienen del SIPS). Se guardan
en `client_data` (JSON) y rellenan el formulario del trámite al convertir la
comparativa, junto con el CUPS, las potencias, el consumo, la tarifa y la
comercializadora actual del estudio.

Sin esta columna no se puede completar un estudio.

Se aplica primero en `test`. En el resto de tenants, con la 023–027.
