import { deleteFolderFromStorage } from "@/core/firebase/data/deleteFolder";
import { getTursoClient } from "@/core/libsql/client";
import { getActiveSupplierNames } from "@/core/libsql/comercializadoras/getActiveSupplierNames";
import {
  DOCUMENT_LIBRARY_ROOT_FOLDER,
  normalizeDocumentLibraryFolderPath,
} from "@/core/utils/document-library-path";
import {
  getDocumentLibraryFolderSubtreeArgs,
  getDocumentLibraryFolderSubtreeSql,
} from "@/documentacion/lib/documentLibraryFolderSql";
import {
  isProtectedSupplierFolder,
  PROTECTED_FOLDER_MESSAGE,
} from "@/documentacion/lib/protected-folders";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Borrar una carpeta recorre todo su contenido: más margen que los 10 s por defecto
export const maxDuration = 60;

interface FolderResponse {
  success: boolean;
  error?: string;
}

// Zod Validation Schemas
const DeleteFolderSchema = z.object({
  folder_path: z.string().min(1, "folder_path is required"),
  organization_id: z.string().min(1, "organization_id is required"),
});

/**
 * Deletes a folder and all its contents (subfolders included) from both
 * Firebase Storage and database. Shared by DELETE and the legacy POST alias
 * (original POST /api/documentacion/delete/folder).
 */
async function deleteFolder(
  request: NextRequest,
  logPrefix: string
): Promise<NextResponse<FolderResponse>> {
  const startTime = performance.now();

  try {
    const body = await request.json();

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

    if (
      isProtectedSupplierFolder(
        normalizedFolderPath,
        await getActiveSupplierNames(tursoClient)
      )
    ) {
      return NextResponse.json(
        { success: false, error: PROTECTED_FOLDER_MESSAGE },
        { status: 403 }
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
        `[${logPrefix}] Storage deletion failed after ${storageDeleteTime.toFixed(2)}ms:`,
        firebaseErrors
      );
      return NextResponse.json(
        { success: false, error: firebaseErrors },
        { status: 500 }
      );
    }

    // Delete the folder subtree from database only after successful storage deletion
    await tursoClient.execute({
      sql: `
        DELETE FROM documentacion_files
        WHERE ${getDocumentLibraryFolderSubtreeSql()}
      `,
      args: getDocumentLibraryFolderSubtreeArgs(normalizedFolderPath),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[${logPrefix}] Error after ${totalTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error eliminando carpeta en el servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<FolderResponse>> {
  return deleteFolder(request, "DOCUMENT-LIBRARY-DELETE-FOLDER");
}

/**
 * Handles backward compatibility for POST requests (legacy support)
 * Maintains exact compatibility with original POST /api/documentacion/delete/folder
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<FolderResponse>> {
  return deleteFolder(request, "DOCUMENT-LIBRARY-DELETE-FOLDER-POST");
}
