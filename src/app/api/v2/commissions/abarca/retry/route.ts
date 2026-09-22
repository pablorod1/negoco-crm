import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { enqueueCommissionSyncStatements } from "@/integrations/abarca/commissions/sync-state";
import { synchronizeCommissionUser } from "@/integrations/abarca/commissions/sync";

export async function POST(request: NextRequest) {
  const auth = await validateUserSession(request);
  if (!auth.success || auth.user?.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = z.object({ user_id: z.string().min(1) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  const db = getTursoClient(request);
  await db.batch(enqueueCommissionSyncStatements([parsed.data.user_id]), "write");
  const state = await db.execute({
    sql: "SELECT * FROM abarca_commission_sync_state WHERE user_id = ?",
    args: [parsed.data.user_id],
  });
  if (!state.rows[0]) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }
  const outcome = await synchronizeCommissionUser(db, state.rows[0]);
  return NextResponse.json({ success: true, data: { outcome } });
}
