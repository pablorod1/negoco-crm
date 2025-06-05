import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { internal_notes, notes, note, is_internal } = await req.json();

    if (!id || !note || typeof is_internal !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Determinar qué array actualizar basado en is_internal
    const currentNotes = is_internal ? internal_notes : notes;

    // Ensure currentNotes is an array, fallback to empty array if null/undefined
    const notesArray = Array.isArray(currentNotes) ? currentNotes : [];
    const updatedNotes = [...notesArray, note];
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

    const columnToUpdate = is_internal ? "internal_notes" : "notes";
    const query = `
      UPDATE tramites
      SET ${columnToUpdate} = ?
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
    console.error("Error al actualizar notas del trámite :", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
