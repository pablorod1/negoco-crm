import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { folder_name }: { folder_name: string } = await req.json();

    if (!folder_name) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
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
            SELECT id, name, size, extension, upload_date, download_url, preview_url, type
            FROM documentacion_files
            WHERE folder_name = ?
          `,
      args: [folder_name],
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
        folder_name,
        type: row[7],
      })),
    });
  } catch (error) {
    console.error("Error obteniendo los archivos en el servidor", error);
    return NextResponse.json(
      { error: "Error obteniendo los archivos en el servidor" },
      { status: 500 }
    );
  }
}
