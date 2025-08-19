import { DocumentacionFile } from "@/core/types";
import { uploadFiles } from "@/core/firebase/data/uploadFiles";
import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const folder_name = formData.get("folder_name") as string;
    const organization_id = formData.get("organization_id") as string;

    if (!files || !folder_name || !organization_id) {
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

    const uploadedFiles = await uploadFiles(
      files,
      `${organization_id}/documentacion`,
      folder_name
    );

    // 2. Prepare database records
    const documentacionFiles: DocumentacionFile[] = files.map((file, index) => {
      const extension = file.name.split(".").pop() || "";

      return {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        extension: extension,
        upload_date: new Date().toISOString(),
        download_url: uploadedFiles[index].downloadURL,
        preview_url: uploadedFiles[index].previewURL || null,
        folder_name,
        type: "file",
      };
    });

    const query = `
          INSERT INTO documentacion_files (id, name, size, extension, upload_date, download_url, preview_url, folder_name, type)
          VALUES ${documentacionFiles
            .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .join(", ")}
        `;

    const params = documentacionFiles.flatMap((file) => [
      file.id,
      file.name,
      file.size,
      file.extension,
      file.upload_date,
      file.download_url,
      file.preview_url,
      folder_name,
      file.type,
    ]);

    await tursoClient.execute({
      sql: query,
      args: params,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error subiendo archivos en el servidor", error);
    return NextResponse.json(
      { error: "Error subiendo archivos en el servidor" },
      { status: 500 }
    );
  }
}
