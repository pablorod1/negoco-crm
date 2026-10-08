# Migración 027: propuestas del comparador propio

Se aplica **en la base de cada tenant** con el módulo del comparador, después
de la 026. Es idempotente.

`comparison_study_proposals` guarda cada propuesta que se genera desde el
panel «Estudio Negoco Cloud»: una oferta del ranking con el fee y las opciones
con que se vio, recalculada en el servidor. `document` es la foto de lo que
enseña el PDF (suministro, lo que paga hoy, precios y costes de la oferta); el
PDF se genera desde ahí cada vez que se abre, así que no hay archivos de las
propuestas descartadas.

Al completar el estudio se marca la elegida (`chosen_at`) y su PDF se sube a
Storage como documento de la comparativa (`comparativa_file_id`).

Sin esta tabla no se pueden generar propuestas ni completar el estudio.

Se aplica primero en `test`. En el resto de tenants, con la 023–026, cuando
test haya completado un estudio 2.0TD (cierre de la fase 4).
