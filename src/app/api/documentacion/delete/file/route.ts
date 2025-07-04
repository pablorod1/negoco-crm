import { deleteFileFromStorage } from "@/core/firebase/data/deleteFile";
import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { files } = await req.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files specified for deletion" },
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

    const results = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      const { folder_path, file_name, file_id, organization_id } = file;

      if (!folder_path || !file_name || !file_id || !organization_id) {
        errors.push(`Missing parameters for file: ${file_name || "unknown"}`);
        continue;
      }

      try {
        // Delete from Firebase storage
        const { success: firebaseSuccess, error: firebaseError } =
          await deleteFileFromStorage(
            "documentacion",
            folder_path,
            file_name,
            organization_id
          );

        if (!firebaseSuccess) {
          errors.push(
            `Firebase deletion failed for ${file_name}: ${firebaseError}`
          );
          continue;
        }

        // Delete from database
        const query = `DELETE FROM documentacion_files WHERE id = ?`;
        await tursoClient.execute({
          sql: query,
          args: [file_id],
        });

        results.push({ file_id, success: true });
      } catch (error) {
        console.error(`Error processing file ${file_name}:`, error);
        errors.push(`Failed to delete ${file_name}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Some files failed to delete",
          details: errors,
          results,
        },
        { status: 207 } // Partial success
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${results.length} file(s)`,
    });
  } catch (error) {
    console.error("Error eliminando archivos en el servidor", error);
    return NextResponse.json(
      { success: false, error: "Error eliminando archivos en el servidor" },
      { status: 500 }
    );
  }
}
