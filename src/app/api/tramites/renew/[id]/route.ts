import { NOW_DATE, RENOVATION_DATE } from "@/lib/core/const";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `UPDATE tramites SET activation_date = ?, renovation_date = ? WHERE id = ?`,
      args: [NOW_DATE.toISOString(), RENOVATION_DATE.toISOString(), id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No existe el tramite",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: "Error updating tramite",
      },
      { status: 500 }
    );
  }
}
