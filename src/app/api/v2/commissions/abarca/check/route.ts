import { NextRequest, NextResponse } from "next/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { inspectCommissionUser } from "@/integrations/abarca/commissions/sync";

/**
 * Audita CRM frente a Comparador sin escribir en el sistema remoto. Solo se
 * revisan estados previamente sincronizados o con atención; los pendientes
 * necesitan enviarse, no compararse.
 */
export async function POST(request: NextRequest) {
  const auth = await validateUserSession(request);
  if (!auth.success || auth.user?.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const db = getTursoClient(request);
  const candidates = await db.execute(`SELECT state.user_id, user.abarca_user_id
    FROM abarca_commission_sync_state state
    INNER JOIN user ON user.id = state.user_id
    WHERE state.status IN ('synced', 'attention')
      AND user.abarca_user_id IS NOT NULL
    ORDER BY user.name`);

  // Cinco comprobaciones paralelas mantienen una carga razonable sobre la API
  // remota sin convertir la auditoría de equipos grandes en una cola serial.
  for (let index = 0; index < candidates.rows.length; index += 5) {
    await Promise.all(candidates.rows.slice(index, index + 5).map(async (row) => {
      const userId = String(row.user_id);
      const abarcaUserId = Number(row.abarca_user_id);
      try {
        const inspection = await inspectCommissionUser(db, userId, abarcaUserId);
        await db.execute({
          sql: `UPDATE abarca_commission_sync_state SET
            status = ?, last_error = NULL, last_warnings = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND status IN ('synced', 'attention')`,
          args: [
            inspection.matches ? "synced" : "attention",
            JSON.stringify(inspection.warnings),
            userId,
          ],
        });
      } catch (error) {
        await db.execute({
          sql: `UPDATE abarca_commission_sync_state SET
            status = 'attention', last_error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND status IN ('synced', 'attention')`,
          args: [
            error instanceof Error ? error.message.slice(0, 1000) : "Error desconocido",
            userId,
          ],
        });
      }
    }));
  }

  const result = await db.execute(`SELECT user.id AS user_id, user.name, user.abarca_user_id,
    COALESCE(state.status, CASE WHEN user.abarca_user_id IS NULL THEN 'not_applicable' ELSE 'pending' END) AS status,
    state.desired_revision, state.confirmed_revision, state.attempts, state.next_attempt_at,
    state.last_error, state.last_warnings, state.last_confirmed_at
    FROM user
    LEFT JOIN abarca_commission_sync_state state ON state.user_id = user.id
    WHERE user.role = '2'
    ORDER BY user.name`);

  return NextResponse.json({ success: true, data: result.rows });
}
