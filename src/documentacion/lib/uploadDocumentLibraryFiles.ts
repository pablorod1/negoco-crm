import { uploadFiles } from "@/core/firebase/data/uploadFiles";
import { deleteFiles } from "@/core/firebase/data/deleteFile";
import {
  getDocumentLibraryStorageFolderName,
  normalizeDocumentLibraryFolderPath,
} from "@/core/utils/document-library-path";

interface UploadDocumentLibraryFilesParams {
  files: File[];
  folderName: string;
  organizationId: string;
}

interface DocumentLibraryFileMetadata {
  name: string;
  size: number;
  extension: string;
  download_url: string;
  preview_url: string | null;
}

interface DocumentLibraryUploadResponse {
  success: boolean;
  error?: string;
}

export async function uploadDocumentLibraryFiles({
  files,
  folderName,
  organizationId,
}: UploadDocumentLibraryFilesParams): Promise<void> {
  if (files.length === 0) {
    throw new Error("No hay archivos para subir");
  }

  if (!organizationId) {
    throw new Error("No se pudo identificar la organización");
  }

  const normalizedFolderName = normalizeDocumentLibraryFolderPath(folderName);
  const uploadedFiles = await uploadFiles(
    files,
    `${organizationId}/documentacion`,
    getDocumentLibraryStorageFolderName(normalizedFolderName)
  );
  const uploadedFilePaths = uploadedFiles
    .map((file) => file.file_path)
    .filter((filePath): filePath is string => Boolean(filePath));

  const fileMetadata: DocumentLibraryFileMetadata[] = files.map(
    (file, index) => ({
      name: file.name,
      size: file.size,
      extension: file.name.split(".").pop() || "",
      download_url: uploadedFiles[index].downloadURL,
      preview_url: uploadedFiles[index].previewURL || null,
    })
  );

  try {
    const response = await fetch("/api/v2/document-library", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        folder_name: normalizedFolderName,
        files: fileMetadata,
      }),
    });

    const result = (await response.json()) as DocumentLibraryUploadResponse;

    if (!response.ok || !result.success) {
      throw new Error(result.error || "No se pudieron registrar los archivos");
    }
  } catch (error) {
    if (uploadedFilePaths.length > 0) {
      await deleteFiles(uploadedFilePaths).catch((deleteError) => {
        console.error("Error limpiando archivos sin registrar:", deleteError);
      });
    }

    throw error;
  }
}
