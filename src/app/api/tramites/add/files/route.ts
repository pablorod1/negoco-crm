import { TramiteFile } from "@/lib/core/types";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
import { getTursoClient } from "@/lib/libsql/client";
import { addTramiteFiles } from "@/lib/libsql/tramites/addTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const files = formData.getAll("files") as File[];
    const id = formData.get("id") as string;
    const organization_id = formData.get("organization_id") as string;

    if (!files || files.length === 0) {
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

    const uploadedFiles: TramiteFile[] = [];

    if (files.length > 0) {
      for (const file of files) {
        try {
          const { downloadURL, previewURL } = await uploadFile(
            file,
            `${organization_id}/tramites`,
            id
          );

          uploadedFiles.push({
            id: crypto.randomUUID(),
            tramite_id: id,
            filename: file.name,
            size: file.size,
            extension: file.name.split(".").pop() as string,
            upload_date: new Date().toISOString(),
            download_url: downloadURL,
            preview_url: previewURL || null,
          });
        } catch (error) {
          console.error("Error al subir archivo:", error);
          return NextResponse.json(
            {
              success: false,
              error: "Error uploading file",
            },
            { status: 500 }
          );
        }
      }
    }

    if (uploadedFiles.length > 0) {
      const insertFilesResult = await addTramiteFiles(
        uploadedFiles,
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
