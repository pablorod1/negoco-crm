import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!id || status === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `
        UPDATE comercializadoras
        SET active = ?
        WHERE id = ?;
      `,
      args: [status, id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Comercializadora not found or no changes made",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating comercializadora status:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
