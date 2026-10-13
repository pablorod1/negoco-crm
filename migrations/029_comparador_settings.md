# Migración 029: ajustes del comparador

Se aplica **en la base de cada tenant** con el módulo del comparador. Es
idempotente (`CREATE TABLE IF NOT EXISTS`).

Guarda ajustes del comparador por tenant. El primero son los **servicios de
ajuste (SSAA) por defecto**: dirección o backoffice los fija en la pestaña
Tarifas (una media en €/MWh o un valor por mes) y el estudio los usa para
ofertar las tarifas que cobran los SSAA aparte (Eleia TRADER SERVICES, Nordy
Estabilidad sin SSAA…). Cada estudio puede cambiarlos con «Simular SSAA».

Sin la tabla el comparador funciona igual: no hay valor por defecto y esas
tarifas solo se ofertan si se simulan en el estudio. Guardar el valor por
defecto sí necesita la tabla.

Se aplica primero en `test` y después en `beenergy`.
