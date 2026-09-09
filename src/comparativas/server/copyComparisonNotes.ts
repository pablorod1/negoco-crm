import type { Client } from "@libsql/client";

/** Subject con el que se guardan las copias, para distinguirlas en el detalle del trámite. */
export const COMPARISON_NOTE_SUBJECT = "Nota de comparativa";

/**
 * Duplica en el trámite las notas rápidas (tickets de tipo `note`, públicas e
 * internas) de la comparativa de origen. La comparativa conserva las suyas.
 *
 * Se conservan autor, fecha, prioridad y visibilidad originales; solo cambian
 * el id, el subject y el destino (`context`/`ref_id`).
 *
 * @param db Cliente o transacción de la creación del trámite
 * @param comparisonId Comparativa de origen
 * @param tramiteId Trámite destino
 * @returns Número de notas copiadas
 */
export async function copyComparisonNotesToTramite(
  db: Pick<Client, "execute">,
  comparisonId: string,
  tramiteId: string,
): Promise<number> {
  const { rows } = await db.execute({
    sql: `SELECT t.message, t.is_internal, t.status_id, t.type_id,
                 t.priority, t.created_by, t.assigned_to, t.created_at
          FROM tickets t
          JOIN ticket_types ty ON ty.id = t.type_id
          WHERE t.context = 'comparativa' AND t.ref_id = ? AND ty.name = 'note'
          ORDER BY t.created_at ASC`,
    args: [comparisonId],
  });

  const now = new Date().toISOString();

  for (const row of rows) {
    await db.execute({
      sql: `INSERT INTO tickets (
        id, subject, message, is_internal, status_id, type_id,
        context, ref_id, priority, created_by, assigned_to,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'tramite', ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        COMPARISON_NOTE_SUBJECT,
        String(row.message),
        row.is_internal ? 1 : 0,
        Number(row.status_id),
        Number(row.type_id),
        tramiteId,
        row.priority === null ? null : String(row.priority),
        String(row.created_by),
        row.assigned_to === null ? null : String(row.assigned_to),
        String(row.created_at),
        now,
      ],
    });
  }

  return rows.length;
}
