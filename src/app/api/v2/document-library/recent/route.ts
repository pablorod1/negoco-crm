import { DocumentacionFile } from "@/core/types";
import { getTursoClient } from "@/core/libsql/client";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import { NextRequest, NextResponse } from "next/server";

// Response Types
interface RecentDocumentsResponse {
  success: boolean;
  data?: DocumentacionFile[];
  error?: string;
}

/**
 * Retrieves recently uploaded documents from the document library
 * Maintains backward compatibility with original POST /api/documentacion/get/recently-files
 * @param request - Next.js request object
 * @returns Promise<NextResponse<RecentDocumentsResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<RecentDocumentsResponse>> {
  const startTime = performance.now();

  try {
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Cliente de base de datos no inicializado" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute(`
      SELECT id, name, size, extension, upload_date, download_url, preview_url, type, folder_name
      FROM documentacion_files
      ORDER BY upload_date DESC
      LIMIT 5
    `);

    const files: DocumentacionFile[] = response.rows.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      size: row[2] as number,
      extension: row[3] as string,
      upload_date: row[4] as string,
      download_url: row[5] as string,
      preview_url: row[6] as string | null,
      type: row[7] as string as "file" | "folder",
      folder_name: normalizeDocumentLibraryFolderPath(row[8] as string),
    }));

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-RECENT] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error obteniendo archivos recientes en el servidor",
      },
      { status: 500 }
    );
  }
}

/**
 * Handles backward compatibility for POST requests (legacy support)
 * Maintains exact compatibility with original POST /api/documentacion/get/recently-files
 * @param request - Next.js request object
 * @returns Promise<NextResponse<RecentDocumentsResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<RecentDocumentsResponse>> {
  const startTime = performance.now();

  try {
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Cliente de base de datos no inicializado" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute(`
      SELECT id, name, size, extension, upload_date, download_url, preview_url, type, folder_name
      FROM documentacion_files
      ORDER BY upload_date DESC
      LIMIT 5
    `);

    const files: DocumentacionFile[] = response.rows.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      size: row[2] as number,
      extension: row[3] as string,
      upload_date: row[4] as string,
      download_url: row[5] as string,
      preview_url: row[6] as string | null,
      type: row[7] as string as "file" | "folder",
      folder_name: normalizeDocumentLibraryFolderPath(row[8] as string),
    }));

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-RECENT-POST] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error obteniendo archivos recientes en el servidor",
      },
      { status: 500 }
    );
  }
}
