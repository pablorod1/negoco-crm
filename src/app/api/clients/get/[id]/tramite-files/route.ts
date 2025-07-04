import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    const res = await tursoClient.execute({
      sql: `
        SELECT 
          *
        FROM tramite_files
        WHERE tramite_id IN (
          SELECT id FROM tramites WHERE client_id = ?
        )
        GROUP BY filename
      `,
      args: [id],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No files found" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, data: res.rows },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Error obteniendo archivos de los trámites del cliente:",
      error
    );
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
