# 018 — Comisiones opcionales sin modificar datos históricos

Ejecutar `018_nullable_comparison_commissions.sql` en **Turso/libSQL**. La migración
quita `NOT NULL` de las cuatro columnas de comisión mediante `ALTER COLUMN`, dentro
de una transacción. No reconstruye ni elimina tablas, no desactiva claves foráneas
y no requiere exportar/importar una base nueva ni cambiar la conexión del CRM.

## Qué cambia

- Todos los importes existentes permanecen exactamente iguales, incluidos los
  ceros de comparativas `pending` y `processing`.
- «No hay ahorro» se sigue mostrando en las comparativas y estados donde corresponde.
- Las nuevas comparativas se crean desde el CRM con las cuatro comisiones `NULL`
  («Sin asignar»). Un cero continúa siendo una comisión explícitamente asignada.
- Una comparativa existente con cero en el plan recibido requerirá confirmación
  antes de sustituirlo por las comisiones de un nuevo estudio.
- La 019 y sus resultados existentes, incluido un ejemplo ya insertado, no cambian.

## Cómo aplicarla

1. Haz una copia de seguridad y prueba primero en TEST. Verifica el destino antes
   de ejecutar SQL. Durante la aplicación pausa las escrituras, callbacks y tareas
   del entorno; despliega el código compatible con `NULL` antes de reanudarlas.

2. Comprueba el esquema y guarda una exportación de los importes actuales para
   compararla después:

   ```sql
   PRAGMA table_info(comparativas);
   SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'comparativas';
   SELECT id, status, comision_fijo, comision_indexado,
          comision_sales_person_fijo, comision_sales_person_indexado
   FROM comparativas ORDER BY id;
   PRAGMA foreign_key_check;
   PRAGMA integrity_check;
   ```

   Las cuatro columnas deben ser `REAL`, sin `DEFAULT` ni otras restricciones de
   columna aparte de `NOT NULL`. Si su definición es distinta, **no ejecutes el
   archivo tal cual**: `ALTER COLUMN ... TO ...` reemplaza la definición completa
   y debe conservar cualquier atributo adicional. Detente también si la integridad
   no es `ok` o hay errores de claves foráneas.

3. En el editor SQL conectado a TEST, ejecuta **todo el contenido** de
   `018_nullable_comparison_commissions.sql`, desde `BEGIN IMMEDIATE` hasta `COMMIT`,
   en una misma sesión y con ejecución que se detenga al primer error. No uses un
   ejecutor que envíe cada sentencia por una conexión distinta o que continúe hasta
   `COMMIT` después de un fallo. Si el editor no garantiza esto, utiliza un cliente
   con transacciones explícitas; no ejecutes los cuatro cambios por separado.

   Si una sentencia falla, no continúes ni hagas `COMMIT`: ejecuta `ROLLBACK` en
   esa misma sesión si la transacción sigue abierta. Si el servidor rechaza
   `ALTER COLUMN`, detente y revisa su compatibilidad; no sustituyas este proceso
   por un `DROP TABLE` ni por modificaciones directas de `sqlite_schema`.

4. Repite las consultas del paso 2. Las cuatro columnas deben mostrar `notnull = 0`,
   todos los importes deben ser idénticos a los anteriores y las comprobaciones
   de integridad y claves foráneas deben seguir siendo correctas. Comprueba los
   recuentos de comparativas, archivos, historial y resultados contra la copia.

5. En TEST, comprueba que una nueva comparativa tenga comisiones «Sin asignar»,
   que las antiguas conserven sus importes y «No hay ahorro», y que se pueda abrir
   el diálogo del resultado existente. Tras validar TEST, sigue el mismo proceso
   con copia de seguridad y verificación por tenant.

## Repetición y rollback

El SQL se puede repetir sobre el mismo esquema: no actualiza importes ni necesita
un marcador de migración. Si ya ejecutaste la antigua 018, conserva también sus
`NULL`; **no recupera automáticamente los ceros que aquella hubiera convertido**.
Para recuperarlos hace falta contrastarlos con una copia anterior, sin convertir
indiscriminadamente todos los `NULL` a cero.

No restaures una versión del CRM que interprete `NULL` como cero. Tampoco vuelvas
a poner `NOT NULL` mientras existan valores sin asignar. Si necesitas restaurar
una copia, pausa las escrituras y reconcilia los cambios posteriores a esa copia.

## Verificación de esta versión

Pruebas locales con el cliente `@libsql/client` del proyecto y una base en memoria:
conservación exacta de filas, ceros en todos los estados, importes no nulos,
índices, triggers, vistas, relaciones, aceptación de `NULL`, repetición, conservación
de resultados de la 019 y rollback ante un fallo intermedio.

Resultado: 54 pruebas en cuatro archivos (migración, creación y visualización de
comisiones), `pnpm type-check` y ESLint focalizado correctos. No se ha repetido el build.

El 2 de septiembre de 2026 se comprobó **solo mediante lectura** que las cuatro
columnas del TEST configurado son `REAL NOT NULL` sin `DEFAULT`. No se ha aplicado
esta migración al servidor; la compatibilidad remota debe validarse primero en TEST.

La reconstrucción offline anterior y su ejecutor TypeScript se han retirado.
Las pruebas antiguas de reconstrucción no certifican esta nueva vía de ejecución.

Referencia: [ALTER COLUMN en libSQL](https://github.com/tursodatabase/libsql/blob/main/libsql-sqlite3/doc/libsql_extensions.md#altering-columns).
Esta extensión no pertenece a SQLite estándar (`sqlite3` / `node:sqlite`).
