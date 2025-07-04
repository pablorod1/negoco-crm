import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name }: { name: string } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "Parámetros faltantes" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { error: "Cliente de base de datos no inicializado" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `
            SELECT id, name, size, extension, upload_date, download_url, preview_url, type, folder_name
            FROM documentacion_files
            WHERE name LIKE ?
          `,
      args: [`%${name}%`],
    });

    return NextResponse.json({
      success: true,
      data: response.rows.map((row) => ({
        id: row[0],
        name: row[1],
        size: row[2],
        extension: row[3],
        upload_date: row[4],
        download_url: row[5],
        preview_url: row[6],
        type: row[7],
        folder_name: row[8],
      })),
    });
  } catch (error) {
    console.error("Error obteniendo archivo en el servidor", error);
    return NextResponse.json(
      { error: "Error obteniendo archivo en el servidor" },
      { status: 500 }
    );
  }
}
