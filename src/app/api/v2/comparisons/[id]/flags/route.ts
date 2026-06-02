import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";

const FlagsUpdateSchema = z.object({
  has_permanencia: z.boolean().optional(),
  has_renovacion: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (authResult.user.role === "2") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = FlagsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const tursoClient = getTursoClient(req);
  if (!tursoClient) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const updates: string[] = [];
  const args: (number | string)[] = [];

  if (parsed.data.has_permanencia !== undefined) {
    updates.push("has_permanencia = ?");
    args.push(parsed.data.has_permanencia ? 1 : 0);
  }
  if (parsed.data.has_renovacion !== undefined) {
    updates.push("has_renovacion = ?");
    args.push(parsed.data.has_renovacion ? 1 : 0);
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  args.push(id);
  const sql = `UPDATE comparativas SET ${updates.join(", ")} WHERE id = ?`;
  const result = await tursoClient.execute({ sql, args });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ success: false, error: "Comparativa no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
