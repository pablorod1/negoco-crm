import { getTursoClient } from "@/core/libsql/client";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tramite_id } = await params;
    const { file_name, organization_id } = await req.json();

    if (!file_name || !tramite_id || !organization_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Faltan parámetros",
        }),
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error al conectar a la base de datos",
        }),
        { status: 500 }
      );
    }

    const res = await tursoClient.execute({
      sql: `DELETE FROM tramite_files WHERE filename = ? AND tramite_id = ?`,
      args: [file_name, tramite_id],
    });

    if (res.rowsAffected === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error al eliminar el archivo de la base de datos",
        }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error al eliminar el archivo",
      }),
      { status: 500 }
    );
  }
}
