import { deleteFolderFromStorage } from "@/core/firebase/data/deleteFolder";
import { getTursoClient } from "@/core/libsql/client";
import {
  DOCUMENT_LIBRARY_ROOT_FOLDER,
  normalizeDocumentLibraryFolderPath,
} from "@/core/utils/document-library-path";
import { normalizedDocumentLibraryFolderNameSql } from "@/documentacion/lib/documentLibraryFolderSql";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Request/Response Types
interface DeleteFolderRequest {
  folder_path: string;
  organization_id: string;
}

interface DeleteFolderResponse {
  success: boolean;
  error?: string;
}

// Zod Validation Schemas
const DeleteFolderSchema = z.object({
  folder_path: z.string().min(1, "folder_path is required"),
  organization_id: z.string().min(1, "organization_id is required"),
});

/**
 * Deletes a folder and all its contents from both Firebase Storage and database
 * Maintains backward compatibility with original POST /api/documentacion/delete/folder
 * @param request - Next.js request object
 * @returns Promise<NextResponse<DeleteFolderResponse>>
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<DeleteFolderResponse>> {
  const startTime = performance.now();

  try {
    const body: DeleteFolderRequest = await request.json();

    // Validate input using Zod
    const validationResult = DeleteFolderSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const { folder_path, organization_id } = validationResult.data;
    const normalizedFolderPath =
      normalizeDocumentLibraryFolderPath(folder_path);

    if (normalizedFolderPath === DOCUMENT_LIBRARY_ROOT_FOLDER) {
      return NextResponse.json(
        { success: false, error: "No se puede eliminar la carpeta raíz" },
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

    // Atomic operation design: Delete files from storage first
    const storageDeleteStartTime = performance.now();
    const { success: firebaseSuccess, errors: firebaseErrors } =
      await deleteFolderFromStorage(
        "documentacion",
        normalizedFolderPath,
        organization_id
      );
    const storageDeleteTime = performance.now() - storageDeleteStartTime;

    if (!firebaseSuccess) {
      console.error(
        `[DOCUMENT-LIBRARY-DELETE-FOLDER] Storage deletion failed after ${storageDeleteTime.toFixed(2)}ms:`,
        firebaseErrors
      );
      return NextResponse.json(
        { success: false, error: firebaseErrors },
        { status: 500 }
      );
    }

    // Delete folder from database only after successful storage deletion
    const query = `
      DELETE FROM documentacion_files
      WHERE folder_name = ?
        OR trim(folder_name) = ?
        OR rtrim(trim(folder_name), '/') = ?
        OR ${normalizedDocumentLibraryFolderNameSql} = ?
    `;
    await tursoClient.execute({
      sql: query,
      args: [
        normalizedFolderPath,
        normalizedFolderPath,
        normalizedFolderPath,
        normalizedFolderPath,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-DELETE-FOLDER] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error eliminando carpeta en el servidor" },
      { status: 500 }
    );
  }
}

/**
 * Handles backward compatibility for POST requests (legacy support)
 * Maintains exact compatibility with original POST /api/documentacion/delete/folder
 * @param request - Next.js request object
 * @returns Promise<NextResponse<DeleteFolderResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<DeleteFolderResponse>> {
  const startTime = performance.now();

  try {
    const body: DeleteFolderRequest = await request.json();

    // Validate input using Zod
    const validationResult = DeleteFolderSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const { folder_path, organization_id } = validationResult.data;
    const normalizedFolderPath =
      normalizeDocumentLibraryFolderPath(folder_path);

    if (normalizedFolderPath === DOCUMENT_LIBRARY_ROOT_FOLDER) {
      return NextResponse.json(
        { success: false, error: "No se puede eliminar la carpeta raíz" },
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

    // Atomic operation design: Delete files from storage first
    const storageDeleteStartTime = performance.now();
    const { success: firebaseSuccess, errors: firebaseErrors } =
      await deleteFolderFromStorage(
        "documentacion",
        normalizedFolderPath,
        organization_id
      );
    const storageDeleteTime = performance.now() - storageDeleteStartTime;

    if (!firebaseSuccess) {
      console.error(
        `[DOCUMENT-LIBRARY-DELETE-FOLDER-POST] Storage deletion failed after ${storageDeleteTime.toFixed(2)}ms:`,
        firebaseErrors
      );
      return NextResponse.json(
        { success: false, error: firebaseErrors },
        { status: 500 }
      );
    }

    // Delete folder from database only after successful storage deletion
    const query = `
      DELETE FROM documentacion_files
      WHERE folder_name = ?
        OR trim(folder_name) = ?
        OR rtrim(trim(folder_name), '/') = ?
        OR ${normalizedDocumentLibraryFolderNameSql} = ?
    `;
    await tursoClient.execute({
      sql: query,
      args: [
        normalizedFolderPath,
        normalizedFolderPath,
        normalizedFolderPath,
        normalizedFolderPath,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[DOCUMENT-LIBRARY-DELETE-FOLDER-POST] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error eliminando carpeta en el servidor" },
      { status: 500 }
    );
  }
}
