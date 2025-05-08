import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
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

    const res = await tursoClient.execute({
      sql: `UPDATE objectives SET completed = 1 WHERE id = ?`,
      args: [id],
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
