# Migración 030: histórico del indexado

Se aplica **en la base de cada tenant** con el módulo del comparador. Es
idempotente (`CREATE TABLE IF NOT EXISTS`).

Para ofertar tarifas indexadas, el comparador necesita lo que cobró cada una
mes a mes: el precio de la energía por periodo (P1, P2, P3) en €/kWh. Con él
calcula lo que habría pagado el cliente en sus 12 meses de consumo del SIPS.
Las comercializadoras lo mandan por el buzón o se carga en la pestaña Tarifas
de cada una. Un histórico puede ser de una tarifa o de toda la comercializadora
(`rate_id` NULL), que vale para las indexadas que no tienen uno propio.

Sin la tabla el comparador funciona igual, pero no oferta ninguna indexada (no
hay histórico) y la pestaña Tarifas avisa de que falta la migración al guardar.

Se aplica primero en `test` y después en `beenergy`, `nasertel` y `eficience`:

    pnpm comparador:migrate --db test --file migrations/030_rate_index_history.sql
