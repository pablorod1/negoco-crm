import { deleteFileFromStorage } from "@/lib/firebase/data/deleteFile";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { file_name, organization_id } = await req.json();

    if (!file_name || !id || !organization_id) {
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

    const { success, error } = await deleteFileFromStorage(
      `comparativas`,
      id,
      file_name,
      organization_id
    );

    if (!success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error,
        }),
        { status: 500 }
      );
    }

    const res = await tursoClient.execute({
      sql: `DELETE FROM comparativa_files WHERE filename = ? AND comparativa_id = ?`,
      args: [file_name, id],
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
