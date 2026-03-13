import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";

const UpdateCommissionSchema = z.object({
  updates: z
    .array(
      z.object({
        tramiteId: z.string().min(1),
        comision: z.number().min(0),
      }),
    )
    .min(1)
    .max(500),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = UpdateCommissionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Datos de comisión inválidos." },
        { status: 400 },
      );
    }

    const { updates } = validation.data;
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Error al conectar con la base de datos." },
        { status: 500 },
      );
    }

    const BATCH_SIZE = 50;
    let totalUpdated = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      const statements = batch.map((u) => ({
        sql: "UPDATE tramites SET comision = ? WHERE id = ?",
        args: [u.comision, u.tramiteId],
      }));

      const results = await tursoClient.batch(statements);
      totalUpdated += results.filter((r) => r.rowsAffected > 0).length;
    }

    console.log("[update-commission]", {
      requested: updates.length,
      updated: totalUpdated,
    });

    return NextResponse.json({ success: true, updated: totalUpdated });
  } catch (error) {
    console.error("[ERROR] update-commission failed:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar comisiones." },
      { status: 500 },
    );
  }
}
