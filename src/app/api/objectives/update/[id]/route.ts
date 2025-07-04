import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const {
      changes,
    }: {
      changes: {
        type: string | undefined;
        peak: number | undefined;
        period: number | undefined;
      };
    } = await req.json();

    if (!id || !changes) {
      return NextResponse.json({
        success: false,
        error: "Missing Parameters",
      });
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json({
        success: false,
        error: "Database not initialized",
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (changes.type) {
      updateFields.push(`type = ?`);
      updateValues.push(changes.type);
    }

    if (changes.peak) {
      updateFields.push(`peak = ?`);
      updateValues.push(changes.peak);
    }

    if (changes.period) {
      updateFields.push(`period = ?`);
      updateValues.push(changes.period);
    }

    const res = await tursoClient.execute({
      sql: `UPDATE objectives SET ${updateFields.join(", ")} WHERE id = ?`,
      args: [...updateValues, id],
    });

    if (res.rowsAffected === 0) {
      return NextResponse.json({
        success: false,
        error: "Objective not found",
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error actualizando objetivo", error);
    return NextResponse.json({
      success: false,
      error: "Internal Server Error",
    });
  }
}
