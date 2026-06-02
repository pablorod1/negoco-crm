import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { z } from "zod";

const ConfigUpdateSchema = z.object({
  commission_pct: z.number().min(0).max(100).nullable().optional(),
  default_notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateUserSession(request);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (authResult.user.role !== "admin" && authResult.user.role !== "1") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = ConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const tursoClient = getTursoClient(request);
  if (!tursoClient) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (parsed.data.commission_pct !== undefined) {
    updates.push("commission_pct = ?");
    args.push(parsed.data.commission_pct);
  }
  if (parsed.data.default_notes !== undefined) {
    updates.push("default_notes = ?");
    args.push(parsed.data.default_notes);
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  args.push(id);
  const sql = `UPDATE user SET ${updates.join(", ")} WHERE id = ?`;
  const result = await tursoClient.execute({ sql, args });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
