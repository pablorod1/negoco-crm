import { deleteFileFromStorage } from "@/lib/firebase/data/deleteFile";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      folder_path,
      file_name,
      file_id,
      organization_id,
    }: {
      folder_path: string;
      file_name: string;
      file_id: string;
      organization_id: string;
    } = await req.json();

    if (!folder_path || !file_name || !file_id || !organization_id) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const { success: firebaseSuccess, errors: firebaseErrors } =
      await deleteFileFromStorage(
        "documentacion",
        folder_path,
        file_name,
        organization_id
      );

    const query = `DELETE FROM documentacion_files WHERE id = ?`;
    // 2. Delete folder from database
    await tursoClient.execute({
      sql: query,
      args: [file_id],
    });

    if (!firebaseSuccess) {
      return NextResponse.json(
        { success: false, error: firebaseErrors },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando archivo en el servidor", error);
    return NextResponse.json(
      { success: false, error: "Error eliminando archivo en el servidor" },
      { status: 500 }
    );
  }
}
