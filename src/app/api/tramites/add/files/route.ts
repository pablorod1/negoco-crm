import { TramiteFile } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { addTramiteFiles } from "@/lib/libsql/tramites/addTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const files = formData.get("files") as string;
    const userDataString = formData.get("userData") as string;
    const userData = JSON.parse(userDataString);
    const tramiteFiles: TramiteFile[] = JSON.parse(files);

    if (!files || files.length === 0 || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: "No files provided",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    if (tramiteFiles.length > 0) {
      const insertFilesResult = await addTramiteFiles(
        tramiteFiles,
        tursoClient
      );

      if (!insertFilesResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Error inserting files",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al subir archivos:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error uploading files",
      },
      { status: 500 }
    );
  }
}
