import { deleteFolderFromStorage } from "@/lib/firebase/data/deleteFolder";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      folder_path,
      organization_id,
    }: { folder_path: string; organization_id: string } = await req.json();

    if (!folder_path || !organization_id) {
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

    const { success: firebaseSuccess, errors: firebaseErrors } =
      await deleteFolderFromStorage(
        "documentacion",
        folder_path,
        organization_id
      );

    const query = `DELETE FROM documentacion_files WHERE folder_name = ?`;
    // 2. Delete folder from database
    await tursoClient.execute({
      sql: query,
      args: [folder_path],
    });

    if (!firebaseSuccess) {
      return NextResponse.json(
        { success: false, error: firebaseErrors },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando carpeta en el servidor", error);
    return NextResponse.json(
      { error: "Error eliminando carpeta en el servidor" },
      { status: 500 }
    );
  }
}
