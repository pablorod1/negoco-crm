# Migración 031: lecturas de anexos compartidas

Se aplica **solo en la base de control** (`negoco-crm-control`). Es idempotente.

`rate_document_readings` guarda, por huella del fichero (sha256), la lectura
de un anexo de precios o comisiones. Las comercializadoras mandan el mismo
anexo a todas las agencias: si Beenergy y Nasertel reciben el mismo PDF, el
primero paga la lectura (0,002–0,13 $) y el segundo la reutiliza gratis. La
aprobación sigue siendo de cada tenant: solo se comparte lo leído.

Solo se guardan las lecturas sin dudas (`ok` o fuera de alcance). Volver a
leer una ingesta desde la revisión siempre llama a la IA y, si sale bien,
sustituye la lectura guardada.

Sin esta migración todo funciona igual, pero cada tenant paga su lectura.

Comprobar con `pnpm comparador:preflight`.
