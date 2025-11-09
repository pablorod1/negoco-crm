import { DocumentacionFile } from "@/core/types";
import { uploadFiles } from "@/core/firebase/data/uploadFiles";
import { deleteFileFromStorage } from "@/core/firebase/data/deleteFile";
import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Request/Response Types
interface DocumentLibraryGetRequest {
  folder_name: string;
}

interface DocumentLibraryGetResponse {
  success: boolean;
  data?: DocumentacionFile[];
  error?: string;
}

interface DocumentLibraryPostResponse {
  success: boolean;
  error?: string;
}

interface DocumentLibraryDeleteRequest {
  files: Array<{
    folder_path: string;
    file_name: string;
    file_id: string;
    organization_id: string;
  }>;
}

interface DocumentLibraryDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string[];
  results?: Array<{ file_id: string; success: boolean }>;
}

// Zod Validation Schemas
const GetQuerySchema = z.object({
  folder_name: z.string().min(1, "folder_name is required"),
});

const DeleteBodySchema = z.object({
  files: z
    .array(
      z.object({
        folder_path: z.string().min(1, "folder_path is required"),
        file_name: z.string().min(1, "file_name is required"),
        file_id: z.string().min(1, "file_id is required"),
        organization_id: z.string().min(1, "organization_id is required"),
      })
    )
    .min(1, "At least one file must be specified"),
});

/**
 * Retrieves document library files by folder name
 * Maintains backward compatibility with original POST /api/documentacion/get/files
 * @param request - Next.js request object
 * @returns Promise<NextResponse<DocumentLibraryGetResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<DocumentLibraryGetResponse>> {
  const startTime = performance.now();

  try {
    // Extract query parameters for GET request
    const { searchParams } = new URL(request.url);
    const folder_name = searchParams.get("folder_name");

    if (!folder_name) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros" },
        { status: 400 }
      );
    }

    // Validate input using Zod
    const validationResult = GetQuerySchema.safeParse({ folder_name });
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Cliente de base de datos no inicializado" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `
        SELECT id, name, size, extension, upload_date, download_url, preview_url, type
        FROM documentacion_files
        WHERE folder_name = ?
        ORDER BY upload_date DESC
      `,
      args: [folder_name],
    });

    const files: DocumentacionFile[] = response.rows.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      size: row[2] as number,
      extension: row[3] as string,
      upload_date: row[4] as string,
      download_url: row[5] as string,
      preview_url: row[6] as string | null,
      folder_name,
      type: row[7] as string as "file" | "folder",
    }));

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-GET] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error obteniendo los archivos en el servidor" },
      { status: 500 }
    );
  }
}

/**
 * Handles backward compatibility for POST requests (legacy support)
 * Maintains exact compatibility with original POST /api/documentacion/get/files
 * @param request - Next.js request object
 * @returns Promise<NextResponse<DocumentLibraryGetResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<
  NextResponse<DocumentLibraryGetResponse | DocumentLibraryPostResponse>
> {
  const startTime = performance.now();

  try {
    const contentType = request.headers.get("content-type") || "";

    // Handle multipart/form-data for file uploads (from /api/documentacion/add)
    if (contentType.includes("multipart/form-data")) {
      return await handleFileUpload(request, startTime);
    }

    // Handle JSON for file listing (from /api/documentacion/get/files)
    return await handleFileListing(request, startTime);
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-POST] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error en el servidor" },
      { status: 500 }
    );
  }
}

/**
 * Handles file upload operations (maintains compatibility with /api/documentacion/add)
 */
async function handleFileUpload(
  request: NextRequest,
  startTime: number
): Promise<NextResponse<DocumentLibraryPostResponse>> {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const folder_name = formData.get("folder_name") as string;
    const organization_id = formData.get("organization_id") as string;

    if (!files || !folder_name || !organization_id) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Upload files to Firebase Storage
    const uploadedFiles = await uploadFiles(
      files,
      `${organization_id}/documentacion`,
      folder_name
    );

    // Prepare database records with optimized batch insert
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

    // Optimized batch insert using prepared statements
    const query = `
      INSERT INTO documentacion_files (id, name, size, extension, upload_date, download_url, preview_url, folder_name, type)
      VALUES ${documentacionFiles.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
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
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-UPLOAD] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error subiendo archivos en el servidor" },
      { status: 500 }
    );
  }
}

/**
 * Handles file listing operations (maintains compatibility with /api/documentacion/get/files)
 */
async function handleFileListing(
  request: NextRequest,
  startTime: number
): Promise<NextResponse<DocumentLibraryGetResponse>> {
  try {
    const { folder_name }: DocumentLibraryGetRequest = await request.json();

    if (!folder_name) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros" },
        { status: 400 }
      );
    }

    // Validate input using Zod
    const validationResult = GetQuerySchema.safeParse({ folder_name });
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Cliente de base de datos no inicializado" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `
        SELECT id, name, size, extension, upload_date, download_url, preview_url, type
        FROM documentacion_files
        WHERE folder_name = ?
        ORDER BY upload_date DESC
      `,
      args: [folder_name],
    });

    const files: DocumentacionFile[] = response.rows.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      size: row[2] as number,
      extension: row[3] as string,
      upload_date: row[4] as string,
      download_url: row[5] as string,
      preview_url: row[6] as string | null,
      folder_name,
      type: row[7] as string as "file" | "folder",
    }));

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-LIST] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error obteniendo los archivos en el servidor" },
      { status: 500 }
    );
  }
}

/**
 * Deletes documents from both Firebase Storage and database
 * Maintains backward compatibility with original POST /api/documentacion/delete/file
 * @param request - Next.js request object
 * @returns Promise<NextResponse<DocumentLibraryDeleteResponse>>
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<DocumentLibraryDeleteResponse>> {
  const startTime = performance.now();

  try {
    const body: DocumentLibraryDeleteRequest = await request.json();

    // Validate input using Zod
    const validationResult = DeleteBodySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "No files specified for deletion",
        },
        { status: 400 }
      );
    }

    const { files } = validationResult.data;

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const results: Array<{ file_id: string; success: boolean }> = [];
    const errors: string[] = [];

    // Process each file with optimized error handling
    for (const file of files) {
      const { folder_path, file_name, file_id, organization_id } = file;

      try {
        // Delete from Firebase storage first (atomic operation design)
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

        // Delete from database only after successful file deletion
        const query = `DELETE FROM documentacion_files WHERE id = ?`;
        await tursoClient.execute({
          sql: query,
          args: [file_id],
        });

        results.push({ file_id, success: true });
      } catch (error) {
        console.error(
          `[DOCUMENT-LIBRARY-DELETE] Error processing file ${file_name}:`,
          error
        );
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
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-DELETE] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error eliminando archivos en el servidor" },
      { status: 500 }
    );
  }
}
