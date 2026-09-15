-- Índice para resolver los tickets de un conjunto de trámites sin escanear
-- toda la tabla. Lo usa la exportación de trámites/liquidez, que agrupa las
-- notas rápidas (tickets de tipo "note") por ref_id en lotes de 500 ids, y
-- también el listado de tickets de la ficha de detalle.
-- La migración es idempotente y no elimina índices.

CREATE INDEX IF NOT EXISTS idx_tickets_context_ref
  ON tickets(context, ref_id, created_at);
