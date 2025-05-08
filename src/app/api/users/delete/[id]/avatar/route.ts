import { storage } from "@/lib/firebase/firebaseConfig";
import { getTursoClient } from "@/lib/libsql/client";
import { deleteObject, listAll, ref } from "firebase/storage";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: user_id } = await params;
    const { organization_id } = await req.json();

    if (!user_id || !organization_id) {
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

    const folderRef = ref(storage, `${organization_id}/avatars/${user_id}`);

    if (!folderRef) {
      return NextResponse.json(
        { success: false, error: "Folder not found" },
        { status: 404 }
      );
    }

    const files = await listAll(folderRef);
    const deleteFiles = await Promise.all(
      files.items.map((fileRef) => deleteObject(fileRef))
    );

    if (deleteFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "Error deleting files" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `UPDATE user SET image = ? WHERE id = ?`,
      args: [null, user_id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        { success: false, error: "Error updating user" },
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
