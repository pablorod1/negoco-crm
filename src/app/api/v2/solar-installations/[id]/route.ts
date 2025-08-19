import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { Row, Client } from "@libsql/client";
import { storage } from "@/core/firebase/firebaseConfig";
import { deleteObject, listAll, ref } from "firebase/storage";

/**
 * Solar installation file interface
 */
interface SolarInstallationFile {
  id: string;
  fotovoltaica_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
}

/**
 * Solar installation user interface
 */
interface SolarInstallationUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Solar installation updated by interface
 */
interface SolarInstallationUpdatedBy {
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Complete solar installation interface
 */
interface SolarInstallationVM {
  id: string;
  type: string;
  client: string;
  client_type: string;
  location: string;
  coordinates: number[] | null;
  creation_date: string;
  activation_date: string | null;
  status: string;
  notes: Record<string, unknown>[];
  internal_notes: Record<string, unknown>[];
  comision: number;
  comision_sales_person: number;
  updated_at: string | null;
  user_id: string;
  user: SolarInstallationUser;
  files: SolarInstallationFile[];
  updated_by: SolarInstallationUpdatedBy;
}

/**
 * API Response interface
 */
interface SolarInstallationResponse {
  success: boolean;
  data?: SolarInstallationVM;
  message?: string;
}

/**
 * Solar installation update response interface
 */
interface SolarInstallationUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Solar installation deletion response interface
 */
interface SolarInstallationDeleteResponse {
  success?: boolean;
  error?: string;
}

/**
 * Solar installation deletion request body interface
 */
interface SolarInstallationDeleteRequest {
  organization_id: string;
}

/**
 * Executes a database update with performance monitoring and error handling
 * @param tursoClient - Database client instance
 * @param query - SQL query string
 * @param params - Query parameters
 * @param operation - Operation name for logging
 * @returns Promise with query result and metrics
 */
async function executeUpdateQuery(
  tursoClient: Client,
  query: string,
  params: (string | number)[],
  operation: string
): Promise<{ success: boolean; rowsAffected: number; error?: string }> {
  const startTime = performance.now();
  
  try {
    const result = await tursoClient.execute({
      sql: query,
      args: params,
    });
    
    const queryTime = performance.now() - startTime;
    
    console.log(`[PERFORMANCE] ${operation} executed in ${queryTime.toFixed(2)}ms. Rows affected: ${result.rowsAffected}`);
    
    return {
      success: true,
      rowsAffected: result.rowsAffected,
    };
  } catch (error) {
    const queryTime = performance.now() - startTime;
    console.error(`[ERROR] ${operation} failed after ${queryTime.toFixed(2)}ms:`, error);
    
    return {
      success: false,
      rowsAffected: 0,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

/**
 * Updates a solar installation with dynamic field updates
 * Maintains EXACT backward compatibility with legacy /api/fotovoltaica/update/[id]
 * @param tursoClient - Database client instance
 * @param installationId - Solar installation ID
 * @param updates - Fields to update
 * @param userId - User performing the update
 * @returns Promise with update result
 */
async function updateSolarInstallation(
  tursoClient: Client,
  installationId: string,
  updates: {
    client?: string;
    client_type?: string;
    type?: string;
    comision?: number;
    comision_sales_person?: number;
    status?: string;
  },
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract individual fields from changes - EXACT legacy pattern
    const {
      client,
      client_type,
      type,
      comision,
      comision_sales_person,
      status,
    } = updates;
    
    const updateFields: string[] = [];

    // Build update fields in EXACT legacy order
    if (client !== undefined) {
      updateFields.push("client = ?");
    }
    if (client_type !== undefined) {
      updateFields.push("client_type = ?");
    }
    if (type !== undefined) {
      updateFields.push("type = ?");
    }
    if (comision !== undefined) {
      updateFields.push("comision = ?");
    }
    if (comision_sales_person !== undefined) {
      updateFields.push("comision_sales_person = ?");
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
    }

    // Add audit fields exactly as legacy
    updateFields.push("updated_by = ?");
    updateFields.push("updated_at = CURRENT_TIMESTAMP");

    // Validate that we have fields to update (excluding audit fields)
    if (updateFields.length === 2) { // Only audit fields present
      return {
        success: false,
        error: "No fields to update provided",
      };
    }

    const query = `
      UPDATE fotovoltaica
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `;

    // Build args array in EXACT legacy order with conditional inclusion
    // CRITICAL: Legacy has inconsistent pattern - must match exactly for compatibility
    // client, client_type, type use truthy checks (excludes empty strings!)
    // comision, comision_sales_person, status use undefined checks
    const args = [
      ...(client ? [client] : []),
      ...(client_type ? [client_type] : []),
      ...(type ? [type] : []),
      ...(comision !== undefined ? [comision] : []),
      ...(comision_sales_person !== undefined ? [comision_sales_person] : []),
      ...(status !== undefined ? [status] : []),
      userId,
      installationId,
    ];

    const result = await executeUpdateQuery(tursoClient, query, args, "update-solar-installation");
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: "No rows affected",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating Fotovoltaica:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Retrieves a solar installation (fotovoltaica) by ID with comprehensive data
 * including files, user information, and authorization filtering
 * 
 * @param req - Next.js request object
 * @param params - Route parameters containing the installation ID
 * @returns Promise<NextResponse<SolarInstallationResponse>>
 * 
 * @example
 * POST /new_api/solar-installations/123
 * Body: { "user_id": "user123", "user_role": "2" }
 * Response: { "success": true, "data": { ... } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SolarInstallationResponse>> {
  try {
    // Extract and validate route parameters
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Installation ID is required" },
        { status: 400 }
      );
    }

    // Parse and validate request body - maintain exact compatibility with legacy validation
    const requestBody = await req.json();
    const { user_id, user_role } = requestBody;

    // Use legacy validation logic for exact compatibility
    if (!user_id || !user_role) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    // Build optimized query with prepared statements
    // Using LEFT JOINs to get all related data in a single query
    let query = `
      SELECT 
        f.id,
        f.type,
        f.client,
        f.client_type,
        f.location,
        f.coordinates,
        f.creation_date,
        f.activation_date,
        f.status,
        f.notes,
        f.internal_notes,
        f.comision,
        f.comision_sales_person,
        f.updated_by,
        f.updated_at,
        f.user_id,
        fd.id AS file_id,
        fd.fotovoltaica_id,
        fd.filename,
        fd.size,
        fd.extension,
        fd.upload_date,
        fd.download_url,
        fd.preview_url,
        u.name AS user_name,
        u.email AS user_email,
        u.image AS user_image,
        ub.name AS updated_by_name,
        ub.email AS updated_by_email,
        ub.image AS updated_by_image
      FROM fotovoltaica f
      LEFT JOIN user u ON f.user_id = u.id
      LEFT JOIN fotovoltaica_files fd ON f.id = fd.fotovoltaica_id
      LEFT JOIN user ub ON f.updated_by = ub.id
      WHERE f.id = ?
    `;

    let queryParams: string[] = [id];

    // Apply role-based access control
    if (user_role === "2") {
      // Commercial users: access to own installations and sub-commercial installations
      const subcomercialesRes = await getSubcomerciales(tursoClient, user_id);
      const subcomercialesIds =
        subcomercialesRes.success && subcomercialesRes.ids
          ? subcomercialesRes.ids
          : [];

      if (subcomercialesIds.length > 0) {
        // Access to own installations and sub-commercial installations
        const placeholders = subcomercialesIds.map(() => "?").join(",");
        query += ` AND (f.user_id = ? OR f.user_id IN (${placeholders}))`;
        queryParams = [...queryParams, user_id, ...subcomercialesIds];
      } else {
        // Access only to own installations
        query += ` AND f.user_id = ?`;
        queryParams = [...queryParams, user_id];
      }
    }

    // Execute the optimized query with prepared statements
    const rs = await tursoClient.execute(query, queryParams);

    // Check if installation exists and user has access
    if (rs.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Fotovoltaica not found" },
        { status: 404 }
      );
    }

    // Process results with type safety
    const firstRow = rs.rows[0] as Row;

    // Parse JSON fields safely
    const parseJsonField = (field: unknown): Record<string, unknown>[] => {
      if (!field) return [];
      try {
        const parsed = JSON.parse(field as string);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const parseCoordinates = (field: unknown): number[] | null => {
      if (!field) return null;
      try {
        const parsed = JSON.parse(field as string);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };

    // Extract solar installation base data
    const solarInstallationData = {
      id: firstRow.id as string,
      type: firstRow.type as string,
      client: firstRow.client as string,
      client_type: firstRow.client_type as string,
      location: firstRow.location as string,
      coordinates: parseCoordinates(firstRow.coordinates),
      creation_date: firstRow.creation_date as string,
      activation_date: firstRow.activation_date as string | null,
      status: firstRow.status as string,
      notes: parseJsonField(firstRow.notes),
      internal_notes: parseJsonField(firstRow.internal_notes),
      comision: Number(firstRow.comision) || 0,
      comision_sales_person: Number(firstRow.comision_sales_person) || 0,
      updated_at: firstRow.updated_at as string | null,
      user_id: firstRow.user_id as string,
    };

    // Extract user data
    const userData: SolarInstallationUser = {
      id: firstRow.user_id as string,
      name: firstRow.user_name as string | null,
      email: firstRow.user_email as string | null,
      image: firstRow.user_image as string | null,
    };

    // Extract updated by data
    const updatedByData: SolarInstallationUpdatedBy = {
      name: firstRow.updated_by_name as string | null,
      email: firstRow.updated_by_email as string | null,
      image: firstRow.updated_by_image as string | null,
    };

    // Extract and deduplicate files
    const filesMap = new Map<string, SolarInstallationFile>();
    rs.rows.forEach((row: Row) => {
      if (row.filename && row.file_id) {
        const fileId = row.file_id as string;
        const fileData: SolarInstallationFile = {
          id: fileId,
          fotovoltaica_id: row.fotovoltaica_id as string,
          filename: row.filename as string,
          size: Number(row.size) || 0,
          extension: row.extension as string,
          upload_date: row.upload_date as string,
          download_url: row.download_url as string,
          preview_url: row.preview_url as string | null,
        };
        filesMap.set(fileId, fileData);
      }
    });

    // Construct the complete solar installation view model
    const solarInstallationVM: SolarInstallationVM = {
      ...solarInstallationData,
      user: userData,
      files: Array.from(filesMap.values()),
      updated_by: updatedByData,
    };

    return NextResponse.json(
      { success: true, data: solarInstallationVM },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error fetching solar installation:", error);
    
    // Return generic error to avoid exposing internal details
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /new_api/solar-installations/[id]
 * 
 * Updates a solar installation (fotovoltaica) by ID
 * Maintains 100% functional compatibility with legacy /api/fotovoltaica/update/[id]
 * 
 * @param req - Next.js request object containing update data
 * @param params - URL parameters containing installation ID
 * @returns Promise<NextResponse<SolarInstallationUpdateResponse>>
 * 
 * @example
 * PATCH /new_api/solar-installations/inst123
 * Body: {
 *   "changes": {
 *     "client": "Updated Client Name",
 *     "status": "completed",
 *     "comision": 75.0
 *   },
 *   "user_id": "user123"
 * }
 * Response: { "success": true, "message": "Fotovoltaica updated successfully" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SolarInstallationUpdateResponse>> {
  const startTime = performance.now();
  
  try {
    // Extract and validate route parameters
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    // Parse and validate request body - maintaining exact compatibility with legacy
    const body = await req.json();
    const { changes, user_id } = body;

    // Maintain exact legacy validation behavior
    if (!id || !changes) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    // Initialize database client
    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Execute update using the helper function
    const updateResult = await updateSolarInstallation(tursoClient, id, changes, user_id);
    
    if (!updateResult.success) {
      return NextResponse.json(
        { success: false, error: updateResult.error || "Update failed" },
        { status: 400 }
      );
    }

    const endTime = performance.now();
    console.log(`[PERFORMANCE] Solar installation update completed in ${(endTime - startTime).toFixed(2)}ms`);

    // Return success response maintaining exact legacy format
    return NextResponse.json(
      { success: true, message: "Fotovoltaica updated successfully" },
      { status: 200 }
    );

  } catch (error) {
    const endTime = performance.now();
    console.error(`[ERROR] Solar installation update failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
    
    // Return error response maintaining exact legacy format
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /new_api/solar-installations/[id]
 * 
 * Deletes a solar installation (fotovoltaica) by ID
 * 
 * @param req - Next.js request object
 * @param params - URL parameters containing installation ID
 * @returns Promise<NextResponse<{ success: boolean; message?: string }>> 
 * 
 * @example
 * DELETE /new_api/solar-installations/inst123
 * Response: { "success": true, "message": "Fotovoltaica deleted successfully" }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SolarInstallationDeleteResponse | { error: string }>> {
  const startTime = performance.now();
  
  try {
    // Extract installation ID from route parameters
    const { id: fotovoltaica_id } = await params;
    
    // Parse request body to get organization_id
    const body: SolarInstallationDeleteRequest = await request.json();
    const { organization_id } = body;

    console.log(`[SOLAR-DELETE] Starting deletion process for installation: ${fotovoltaica_id}, organization: ${organization_id}`);

    // Validate required parameters - maintain exact original validation
    if (!fotovoltaica_id || !organization_id) {
      console.warn(`[SOLAR-DELETE] Missing parameters - ID: ${fotovoltaica_id}, Org: ${organization_id}`);
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Initialize database client with error handling
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      console.error("[SOLAR-DELETE] Database client initialization failed");
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Step 1: Delete all associated files from Firebase Storage
    // This follows the exact pattern from the original endpoint
    const storageRef = ref(
      storage,
      `${organization_id}/fotovoltaicas/${fotovoltaica_id}`
    );

    const fileDeleteStartTime = performance.now();
    
    try {
      console.log(`[SOLAR-DELETE] Listing files in storage path: ${organization_id}/fotovoltaicas/${fotovoltaica_id}`);
      
      // List all files in the installation folder
      const fileList = await listAll(storageRef);
      
      console.log(`[SOLAR-DELETE] Found ${fileList.items.length} files to delete`);

      // Delete each file concurrently for optimal performance
      const deletePromises = fileList.items.map((fileRef) =>
        deleteObject(fileRef)
      );
      
      await Promise.all(deletePromises);
      
      const fileDeleteTime = performance.now() - fileDeleteStartTime;
      console.log(`[SOLAR-DELETE] Successfully deleted ${fileList.items.length} files in ${fileDeleteTime.toFixed(2)}ms`);
      
    } catch (storageError) {
      const fileDeleteTime = performance.now() - fileDeleteStartTime;
      console.error(`[SOLAR-DELETE] Storage deletion failed after ${fileDeleteTime.toFixed(2)}ms:`, storageError);
      
      // If file deletion fails, abort the entire operation to maintain data consistency
      // This matches the exact behavior from the original endpoint
      return NextResponse.json(
        {
          success: false,
          error: "Error al eliminar los archivos asociados a la solicitud",
        },
        { status: 500 }
      );
    }

    // Step 2: Only if files were deleted successfully, remove the database record
    // This maintains the exact transaction pattern from the original endpoint
    const dbDeleteStartTime = performance.now();
    
    console.log(`[SOLAR-DELETE] Deleting database record for installation: ${fotovoltaica_id}`);
    
    const response = await tursoClient.execute({
      sql: `DELETE FROM fotovoltaica WHERE id = ?`,
      args: [fotovoltaica_id],
    });

    const dbDeleteTime = performance.now() - dbDeleteStartTime;
    
    console.log(`[SOLAR-DELETE] Database deletion executed in ${dbDeleteTime.toFixed(2)}ms. Rows affected: ${response.rowsAffected}`);

    // Validate that the installation was found and deleted
    if (response.rowsAffected === 0) {
      console.warn(`[SOLAR-DELETE] Installation not found: ${fotovoltaica_id}`);
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró el trámite",
        },
        { status: 404 }
      );
    }

    const totalTime = performance.now() - startTime;
    console.log(`[SOLAR-DELETE] Installation ${fotovoltaica_id} deleted successfully in ${totalTime.toFixed(2)}ms`);

    // Return success response exactly matching original format
    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(`[SOLAR-DELETE] Deletion failed after ${totalTime.toFixed(2)}ms:`, error);
    
    // Return generic error response matching original pattern EXACTLY
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
