import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";

const BulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
  status: z.boolean(),
});

interface BulkStatusResponse {
  success: boolean;
  updated?: number;
  error?: string;
}

/**
 * Activa o desactiva varias comercializadoras en una sola sentencia.
 * Lo usa el botón "Activar/Desactivar todas" del listado.
 */
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<BulkStatusResponse>> {
  try {
    const validation = BulkStatusSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    const { ids, status } = validation.data;
    const placeholders = ids.map(() => "?").join(", ");
    const result = await tursoClient.execute({
      sql: `UPDATE comercializadoras SET active = ? WHERE id IN (${placeholders})`,
      args: [status ? 1 : 0, ...ids],
    });

    return NextResponse.json({ success: true, updated: result.rowsAffected });
  } catch (error) {
    console.error("[API Error] Bulk energy supplier status update failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
