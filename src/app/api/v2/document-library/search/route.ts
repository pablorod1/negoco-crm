import { DocumentacionFile } from "@/core/types";
import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Request/Response Types
interface SearchDocumentsRequest {
  name: string;
}

interface SearchDocumentsResponse {
  success: boolean;
  data?: DocumentacionFile[];
  error?: string;
}

// Zod Validation Schemas
const SearchQuerySchema = z.object({
  name: z.string().min(1, "name is required"),
});

const SearchBodySchema = z.object({
  name: z.string().min(1, "name is required"),
});

/**
 * Searches documents by name using query parameters (GET)
 * Provides RESTful API access for document search
 * @param request - Next.js request object
 * @returns Promise<NextResponse<SearchDocumentsResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SearchDocumentsResponse>> {
  const startTime = performance.now();

  try {
    // Extract query parameters for GET request
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Parámetros faltantes" },
        { status: 400 }
      );
    }

    // Validate input using Zod
    const validationResult = SearchQuerySchema.safeParse({ name });
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Parámetros faltantes" },
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
        SELECT id, name, size, extension, upload_date, download_url, preview_url, type, folder_name
        FROM documentacion_files
        WHERE name LIKE ?
        ORDER BY upload_date DESC
      `,
      args: [`%${name}%`],
    });

    const files: DocumentacionFile[] = response.rows.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      size: row[2] as number,
      extension: row[3] as string,
      upload_date: row[4] as string,
      download_url: row[5] as string,
      preview_url: row[6] as string | null,
      type: row[7] as string as "file" | "folder",
      folder_name: row[8] as string,
    }));

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-SEARCH] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error obteniendo archivo en el servidor" },
      { status: 500 }
    );
  }
}

/**
 * Handles backward compatibility for POST requests (legacy support)
 * Maintains exact compatibility with original POST /api/documentacion/get/files-by-name
 * @param request - Next.js request object
 * @returns Promise<NextResponse<SearchDocumentsResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SearchDocumentsResponse>> {
  const startTime = performance.now();

  try {
    const { name }: SearchDocumentsRequest = await request.json();

    // Validate input using Zod
    const validationResult = SearchBodySchema.safeParse({ name });
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Parámetros faltantes" },
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
        SELECT id, name, size, extension, upload_date, download_url, preview_url, type, folder_name
        FROM documentacion_files
        WHERE name LIKE ?
        ORDER BY upload_date DESC
      `,
      args: [`%${name}%`],
    });

    const files: DocumentacionFile[] = response.rows.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      size: row[2] as number,
      extension: row[3] as string,
      upload_date: row[4] as string,
      download_url: row[5] as string,
      preview_url: row[6] as string | null,
      type: row[7] as string as "file" | "folder",
      folder_name: row[8] as string,
    }));

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-SEARCH-POST] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error obteniendo archivo en el servidor" },
      { status: 500 }
    );
  }
}
