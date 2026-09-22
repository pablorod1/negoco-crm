import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { enqueueCommissionSyncStatements } from "@/integrations/abarca/commissions/sync-state";

const mappingSchema = z.object({
  comercializadora_id: z.string().min(1),
  segment: z.enum(["luz_20td", "luz_pymes", "gas"]),
  abarca_name: z.string().trim().min(1).max(120),
});

const putSchema = z.object({ mappings: z.array(mappingSchema) });

async function admin(request: NextRequest) {
  const auth = await validateUserSession(request);
  return auth.success && auth.user?.role === "admin";
}

export async function GET(request: NextRequest) {
  if (!(await admin(request))) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const db = getTursoClient(request);
  const result = await db.execute(`SELECT mapping.id, mapping.comercializadora_id,
    supplier.name AS comercializadora_name, mapping.segment, mapping.abarca_name,
    mapping.created_at, mapping.updated_at
    FROM abarca_commission_mappings mapping
    LEFT JOIN comercializadoras supplier ON supplier.id = mapping.comercializadora_id
    ORDER BY supplier.name, mapping.segment, mapping.abarca_name`);
  return NextResponse.json({ success: true, data: result.rows });
}

export async function PUT(request: NextRequest) {
  if (!(await admin(request))) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  const remoteKeys = new Set<string>();
  const localKeys = new Set<string>();
  for (const mapping of parsed.data.mappings) {
    const remote = `${mapping.segment}:${mapping.abarca_name.toLocaleUpperCase("es")}`;
    const local = `${mapping.comercializadora_id}:${mapping.segment}:${mapping.abarca_name.toLocaleUpperCase("es")}`;
    if (remoteKeys.has(remote) || localKeys.has(local)) {
      return NextResponse.json({ success: false, error: "Hay mapeos duplicados o en conflicto" }, { status: 400 });
    }
    remoteKeys.add(remote);
    localKeys.add(local);
  }
  const db = getTursoClient(request);
  const users = await db.execute("SELECT id FROM user WHERE role = '2'");
  await db.batch([
    { sql: "DELETE FROM abarca_commission_mappings", args: [] },
    ...parsed.data.mappings.map((mapping) => ({
      sql: `INSERT INTO abarca_commission_mappings
        (id, comercializadora_id, segment, abarca_name) VALUES (?, ?, ?, ?)`,
      args: [crypto.randomUUID(), mapping.comercializadora_id, mapping.segment, mapping.abarca_name],
    })),
    ...enqueueCommissionSyncStatements(users.rows.map((row) => String(row.id))),
  ], "write");
  return GET(request);
}
