# Migración 026: estudios del comparador propio

Se aplica **en la base de cada tenant** con el módulo del comparador, después
de la 024. Es idempotente.

`comparison_studies` guarda cada análisis de factura de una comparativa: lo
extraído de la factura (del texto anonimizado), el suministro con el que se
compara (consumo de 12 meses y potencia del SIPS, o la factura llevada a un
año), las opciones del estudio (fee, canal) y la oferta elegida con su coste,
ahorro y comisión. El ranking no se guarda: se recalcula con los precios
vigentes en `price_date`.

Sin esta tabla el panel «Estudio Negoco Cloud» no puede analizar facturas.

Se aplica primero en `test`. En el resto de tenants, con la 023–025, cuando
test haya completado un estudio 2.0TD (cierre de la fase 4).
