import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json(); // Obtener el id desde el cuerpo de la solicitud

    if (!ids) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `DELETE FROM notifications WHERE id IN (${ids.map(() => "?").join(",")})`,
      args: ids,
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }); // Respuesta exitosa
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
