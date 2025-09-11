import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";

export async function DELETE(request: NextRequest) {
  try {
    // Validate authentication
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { context, ref_id } = body;

    if (!context || !ref_id) {
      return NextResponse.json(
        { success: false, error: "Context and ref_id are required" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);

    // Delete all tickets for this context and ref_id
    const result = await tursoClient.execute({
      sql: "DELETE FROM tickets WHERE context = ? AND ref_id = ?",
      args: [context, ref_id],
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.rowsAffected} tickets for ${context}:${ref_id}`,
      deletedCount: result.rowsAffected,
    });
  } catch (error) {
    console.error("Error cleaning up tickets:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
