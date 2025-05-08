import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { field, date } = await req.json();

    if (!field || !date || !id) {
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

    const updateFields = [`${field} = ?`];
    const queryArgs = [date];

    const query = `UPDATE tramites SET ${updateFields.join(", ")} WHERE id = ?`;

    queryArgs.push(id);
    const result = await tursoClient.execute(query, queryArgs);

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tramite not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error al actualizar el estado del trámite :", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
