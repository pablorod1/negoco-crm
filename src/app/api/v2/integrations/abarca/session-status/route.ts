import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const tursoClient = getTursoClient(req);
  const host = req.headers.get("host");
  const tenant = host ? host.split(".")[0] : "unknown";

  // Expire stale sessions (>20 min TTL)
  await tursoClient.execute({
    sql: `UPDATE abarca_sessions SET status = 'expired'
          WHERE tenant = ? AND status = 'pending'
          AND created_at < datetime('now', '-20 minutes')`,
    args: [tenant],
  });

  const result = await tursoClient.execute({
    sql: `SELECT user_id FROM abarca_sessions
          WHERE tenant = ? AND status = 'pending'
          ORDER BY created_at DESC LIMIT 1`,
    args: [tenant],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ hasPendingSession: false });
  }

  const isOwnSession = (result.rows[0].user_id as string) === userId;

  return NextResponse.json({ hasPendingSession: true, isOwnSession });
}
