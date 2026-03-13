import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";

export async function POST(req: NextRequest) {
  const { ide, idcm, comparativa_id, user_id } = await req.json();

  const { ABARCA_API_KEY, ABARCA_TOKEN } = process.env;

  if (!ABARCA_API_KEY || !ABARCA_TOKEN) {
    return NextResponse.json(
      { error: "Missing Environment Variables" },
      { status: 500 },
    );
  }

  // Register session for concurrency control (block other users while one is active)
  if (comparativa_id && user_id) {
    try {
      const tursoClient = getTursoClient(req);
      const host = req.headers.get("host");
      const tenant = host ? host.split(".")[0] : "unknown";

      // Expire own previous sessions + any stale sessions (>30 min TTL)
      await tursoClient.execute({
        sql: `UPDATE abarca_sessions SET status = 'expired'
              WHERE crm_id = ? AND tenant = ? AND status = 'pending'
              AND (user_id = ? OR created_at < datetime('now', '-30 minutes'))`,
        args: [idcm, tenant, user_id],
      });

      await tursoClient.execute({
        sql: `INSERT INTO abarca_sessions (id, comparativa_id, crm_id, tenant, user_id, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
        args: [crypto.randomUUID(), comparativa_id, idcm, tenant, user_id],
      });
    } catch (error) {
      console.error("Error registering Abarca session:", error);
    }
  }

  const response = await fetch(
    "https://abarcaia.com/comparar/api/generate-login-token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ABARCA_API_KEY,
      },
      body: JSON.stringify({
        ide,
        idcm,
        clave: ABARCA_TOKEN,
        comparativa_id,
      }),
    },
  );

  if (!response.ok) {
    console.error("Error fetching Abarca login token:", await response.text());
    return NextResponse.json(
      { error: "Error fetching Abarca login token" },
      { status: 500 },
    );
  }

  const data = await response.json();

  return NextResponse.json({ loginUrl: data.login_url });
}
