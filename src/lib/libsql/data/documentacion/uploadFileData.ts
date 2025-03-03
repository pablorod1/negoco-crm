import { DocumentacionFile } from "@/lib/core/types";
import { tursoClient } from "../../client";
import { uploadFiles } from "@/lib/firebase/data/uploadFiles";

export const addDocumentacionFiles = async (
  files: File[],
  folder_name: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // 1. Upload files to Firebase Storage
    const uploadedFiles = await uploadFiles(
      files,
      "documentacion",
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

    // 3. Insert into database
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

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error processing files:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error processing files",
    };
  }
};
