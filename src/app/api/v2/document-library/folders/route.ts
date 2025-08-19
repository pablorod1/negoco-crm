import { deleteFolderFromStorage } from "@/core/firebase/data/deleteFolder";
import { getTursoClient } from "@/core/libsql/client";
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

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    console.log(`[DOCUMENT-LIBRARY-DELETE-FOLDER] Starting deletion of folder: ${folder_path}`);

    // Atomic operation design: Delete files from storage first
    const storageDeleteStartTime = performance.now();
    const { success: firebaseSuccess, errors: firebaseErrors } =
      await deleteFolderFromStorage(
        "documentacion",
        folder_path,
        organization_id
      );
    const storageDeleteTime = performance.now() - storageDeleteStartTime;

    if (!firebaseSuccess) {
      console.error(`[DOCUMENT-LIBRARY-DELETE-FOLDER] Storage deletion failed after ${storageDeleteTime.toFixed(2)}ms:`, firebaseErrors);
      return NextResponse.json(
        { success: false, error: firebaseErrors },
        { status: 500 }
      );
    }

    // Delete folder from database only after successful storage deletion
    const dbDeleteStartTime = performance.now();
    const query = `DELETE FROM documentacion_files WHERE folder_name = ?`;
    await tursoClient.execute({
      sql: query,
      args: [folder_path],
    });
    const dbDeleteTime = performance.now() - dbDeleteStartTime;

    const totalTime = performance.now() - startTime;
    console.log(`[DOCUMENT-LIBRARY-DELETE-FOLDER] Successfully deleted folder "${folder_path}" in ${totalTime.toFixed(2)}ms (storage: ${storageDeleteTime.toFixed(2)}ms, db: ${dbDeleteTime.toFixed(2)}ms)`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(`[DOCUMENT-LIBRARY-DELETE-FOLDER] Error after ${totalTime.toFixed(2)}ms:`, error);
    
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

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    console.log(`[DOCUMENT-LIBRARY-DELETE-FOLDER-POST] Starting deletion of folder (legacy POST): ${folder_path}`);

    // Atomic operation design: Delete files from storage first
    const storageDeleteStartTime = performance.now();
    const { success: firebaseSuccess, errors: firebaseErrors } =
      await deleteFolderFromStorage(
        "documentacion",
        folder_path,
        organization_id
      );
    const storageDeleteTime = performance.now() - storageDeleteStartTime;

    if (!firebaseSuccess) {
      console.error(`[DOCUMENT-LIBRARY-DELETE-FOLDER-POST] Storage deletion failed after ${storageDeleteTime.toFixed(2)}ms:`, firebaseErrors);
      return NextResponse.json(
        { success: false, error: firebaseErrors },
        { status: 500 }
      );
    }

    // Delete folder from database only after successful storage deletion
    const dbDeleteStartTime = performance.now();
    const query = `DELETE FROM documentacion_files WHERE folder_name = ?`;
    await tursoClient.execute({
      sql: query,
      args: [folder_path],
    });
    const dbDeleteTime = performance.now() - dbDeleteStartTime;

    const totalTime = performance.now() - startTime;
    console.log(`[DOCUMENT-LIBRARY-DELETE-FOLDER-POST] Successfully deleted folder "${folder_path}" in ${totalTime.toFixed(2)}ms (storage: ${storageDeleteTime.toFixed(2)}ms, db: ${dbDeleteTime.toFixed(2)}ms)`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(`[DOCUMENT-LIBRARY-DELETE-FOLDER-POST] Error after ${totalTime.toFixed(2)}ms:`, error);
    
    return NextResponse.json(
      { success: false, error: "Error eliminando carpeta en el servidor" },
      { status: 500 }
    );
  }
}
