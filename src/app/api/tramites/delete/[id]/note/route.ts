import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { note, notes } = await req.json();

    if (!id || !note || !notes) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const updatedNotes = notes.filter((n: string) => n !== note);
    const notesJSON = JSON.stringify(updatedNotes);

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

    const query = `
      UPDATE tramites
      SET notes = ?
      WHERE id = ?
    `;

    const response = await tursoClient.execute({
      sql: query,
      args: [notesJSON, id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No rows affected",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error al eliminar nota del trámite:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
