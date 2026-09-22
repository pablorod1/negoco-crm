import { NextRequest, NextResponse } from "next/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";

export async function GET(request: NextRequest) {
  const auth = await validateUserSession(request);
  if (!auth.success || auth.user?.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const db = getTursoClient(request);
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
