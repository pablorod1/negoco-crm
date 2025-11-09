import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { Client } from "@libsql/client";
import {
  ClientDB,
  ContractDB,
  EditTramiteFormData,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/tramites/types";

// Response Types
interface ContractByIdResponse {
  success: boolean;
  error?: string;
  data?: EditTramiteFormData;
}

// Extended tramite query result with user information
interface TramiteQueryResult
  extends Omit<TramiteDB, "notes" | "internal_notes"> {
  notes: string; // DB stores as string, converted to array after
  internal_notes: string; // DB stores as string, converted to array after
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  user_image: string | null;
  updated_by_name: string;
  updated_by_email: string;
  updated_by_role: string;
  updated_by_image: string | null;
  updated_by: string;
  updated_at: string;
}

// Zod validation schemas
const RequestBodySchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
  role: z.string().min(1, "User role is required"),
  user_id: z.string().min(1, "User ID is required"),
});

/**
 * Executes a database query with proper error handling and performance monitoring
 * @param query - SQL query string
 * @param args - Query parameters
 * @param tursoClient - Turso database client
 * @returns Promise with typed results
 */
async function executeQuery<T>(
  query: string,
  args: string[],
  tursoClient: Client
): Promise<T[]> {
  const startTime = performance.now();

  try {
    const result = await tursoClient.execute({ sql: query, args });

    return result.rows as T[];
  } catch (error) {
    const queryTime = performance.now() - startTime;
    console.error(
      `[ERROR] Query failed after ${queryTime.toFixed(2)}ms:`,
      error
    );
    throw error;
  }
}

/**
 * Builds the optimized tramite query with role-based access control
 * @param id - Contract ID
 * @param role - User role
 * @param user_id - User ID
 * @param tursoClient - Database client for subcomerciales lookup
 * @returns Promise with query and parameters
 */
async function buildTramiteQuery(
  id: string,
  role: string,
  user_id: string,
  tursoClient: Client
): Promise<{ query: string; params: string[] }> {
  // Optimized base query with explicit JOIN conditions for better performance
  let query = `
    SELECT 
      t.*, 
      u.id as user_id, 
      u.name as user_name, 
      u.email as user_email, 
      u.role as user_role, 
      u.image as user_image,
      ub.name as updated_by_name,
      ub.image as updated_by_image,
      ub.email as updated_by_email,
      ub.role as updated_by_role
    FROM tramites t
    INNER JOIN user u ON t.user_id = u.id
    LEFT JOIN user ub ON t.updated_by = ub.id
    WHERE t.id = ?`;

  let queryParams = [id];

  // Apply role-based access control
  if (role === "2") {
    // Get subcomerciales with optimized lookup
    const subcomercialesRes = await getSubcomerciales(tursoClient, user_id);
    const subcomercialesIds =
      subcomercialesRes.success && subcomercialesRes.ids
        ? subcomercialesRes.ids
        : [];

    // Build parameterized query for security and performance
    if (subcomercialesIds.length > 0) {
      const placeholders = subcomercialesIds.map(() => "?").join(",");
      query += ` AND (t.user_id = ? OR t.user_id IN (${placeholders}))`;
      queryParams = [...queryParams, user_id, ...subcomercialesIds];
    } else {
      query += ` AND t.user_id = ?`;
      queryParams = [...queryParams, user_id];
    }
  }

  return { query, params: queryParams };
}

/**
 * Executes all related queries in parallel for optimal performance
 * @param id - Contract ID
 * @param tramiteQuery - Prepared tramite query
 * @param tramiteParams - Tramite query parameters
 * @param tursoClient - Database client
 * @returns Promise with all related data
 */
async function executeParallelQueries(
  id: string,
  tramiteQuery: string,
  tramiteParams: string[],
  tursoClient: Client
) {
  // Execute all queries in parallel for performance optimization
  const [
    tramiteResult,
    clientResult,
    contractsResult,
    signerResult,
    filesResult,
  ] = await Promise.all([
    executeQuery<TramiteQueryResult>(tramiteQuery, tramiteParams, tursoClient),
    executeQuery<ClientDB>(
      `SELECT * FROM clients WHERE id = (SELECT client_id FROM tramites WHERE id = ?)`,
      [id],
      tursoClient
    ),
    executeQuery<ContractDB>(
      `SELECT * FROM contracts WHERE tramite_id = ? ORDER BY id`,
      [id],
      tursoClient
    ),
    executeQuery<SignerDB>(
      `SELECT s.* FROM signers s 
       INNER JOIN tramites t ON t.client_id = s.client_id 
       WHERE t.id = ?
       LIMIT 1`,
      [id],
      tursoClient
    ),
    executeQuery<TramiteFile>(
      `SELECT * FROM tramite_files WHERE tramite_id = ? ORDER BY upload_date DESC`,
      [id],
      tursoClient
    ),
  ]);

  return {
    tramite: tramiteResult,
    client: clientResult,
    contracts: contractsResult,
    signer: signerResult,
    files: filesResult,
  };
}

/**
 * Transforms raw tramite data into the expected response format
 * @param tramiteRow - Raw tramite data from database
 * @param clientData - Client information
 * @param contractsData - Contract information
 * @param signerData - Signer information
 * @param filesData - File information
 * @returns Formatted EditTramiteFormData
 */
function transformTramiteData(
  tramiteRow: TramiteQueryResult,
  clientData: ClientDB[],
  contractsData: ContractDB[],
  signerData: SignerDB[],
  filesData: TramiteFile[]
): EditTramiteFormData {
  const {
    user_name,
    user_email,
    user_role,
    user_image,
    updated_by_name,
    updated_by_email,
    updated_by_role,
    updated_by_image,
    notes: notesString,
    internal_notes: internalNotes,
    ...tramiteData
  } = tramiteRow;

  // Parse JSON strings exactly as original (with potential error throws)
  let parsedNotes: string[] = [];
  let parsedInternalNotes: string[] = [];

  try {
    parsedNotes = JSON.parse(notesString); // Same as original - can throw
  } catch {
    parsedNotes = []; // Fallback if parsing fails
  }

  try {
    parsedInternalNotes = JSON.parse(internalNotes) || []; // Same as original pattern
  } catch {
    parsedInternalNotes = []; // Fallback if parsing fails
  }

  return {
    tramite: {
      ...tramiteData,
      notes: parsedNotes,
      internal_notes: parsedInternalNotes,
      user: {
        id: tramiteData.user_id,
        name: user_name,
        email: user_email,
        role: user_role,
        image: user_image,
      },
      updated_by: updated_by_name
        ? {
            name: updated_by_name,
            email: updated_by_email,
            role: updated_by_role,
            image: updated_by_image,
          }
        : null,
      updated_at: tramiteData.updated_at,
    },
    client: clientData[0],
    contracts: contractsData,
    signer: signerData[0],
    files: filesData,
  };
}

/**
 * Retrieves a specific contract (tramite) by ID with all related data
 *
 * Maintains 100% compatibility with legacy /api/tramites/get/[id] endpoint
 * while implementing performance optimizations and modern patterns.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing contract ID
 * @returns Promise<NextResponse<ContractByIdResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContractByIdResponse>> {
  const requestStartTime = performance.now();

  try {
    // Extract route parameters
    const { id: routeId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validatedBody = RequestBodySchema.parse(body);

    const { id: bodyId, role, user_id } = validatedBody;

    // Use ID from body (maintaining legacy compatibility) or fallback to route param
    const contractId = bodyId || routeId;

    if (!contractId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Initialize database connection with error handling
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Build optimized query with role-based access control
    const { query: tramiteQuery, params: tramiteParams } =
      await buildTramiteQuery(contractId, role, user_id, tursoClient);

    // Execute all queries in parallel for performance
    const queryResults = await executeParallelQueries(
      contractId,
      tramiteQuery,
      tramiteParams,
      tursoClient
    );

    // Check if contract exists and user has access
    if (queryResults.tramite.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No tienes permiso para acceder a este trámite",
        },
        { status: 403 }
      );
    }

    // Transform data to expected format
    const responseData = transformTramiteData(
      queryResults.tramite[0],
      queryResults.client,
      queryResults.contracts,
      queryResults.signer,
      queryResults.files
    );

    // Return successful response
    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const totalRequestTime = performance.now() - requestStartTime;

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error(
        `[VALIDATION ERROR] Request failed after ${totalRequestTime.toFixed(2)}ms:`,
        error.issues
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request parameters",
        },
        { status: 400 }
      );
    }

    // Handle general errors
    console.error(
      `[ERROR] Contract by ID request failed after ${totalRequestTime.toFixed(2)}ms:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching tramite by id",
      },
      { status: 500 }
    );
  }
}

// DELETE method types and schemas
interface DeleteContractResponse {
  success: boolean;
  error?: string;
}

const DeleteContractRequestSchema = z.object({
  organization_id: z.string().min(1, "Organization ID is required"),
});

/**
 * Deletes a contract (tramite) by ID along with all associated files from Firebase Storage
 *
 * Maintains 100% compatibility with legacy /api/tramites/delete/[id] endpoint.
 * This is a destructive operation that:
 * 1. Deletes all files from Firebase Storage associated with the contract
 * 2. Deletes the contract record from the database
 *
 * The operation is atomic - if file deletion fails, the database deletion is aborted.
 *
 * @param request - Next.js request object containing organization_id in body
 * @param params - Route parameters containing contract ID
 * @returns Promise<NextResponse<DeleteContractResponse>>
 *
 * @example
 * DELETE /new_api/contracts/[id]
 * Content-Type: application/json
 *
 * {
 *   "organization_id": "org123"
 * }
 *
 * Response:
 * {
 *   "success": true
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DeleteContractResponse>> {
  const requestStartTime = performance.now();

  try {
    // Import Firebase Storage dependencies
    const { storage } = await import("@/core/firebase/firebaseConfig");
    const { deleteObject, listAll, ref } = await import("firebase/storage");

    // Extract route parameters
    const { id: tramite_id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = DeleteContractRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { organization_id } = validationResult.data;

    if (!tramite_id || !organization_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Step 1: Delete all associated files from Firebase Storage
    const storageRef = ref(
      storage,
      `${organization_id}/tramites/${tramite_id}`
    );

    try {
      // List all files in the contract's storage folder
      const fileList = await listAll(storageRef);

      // Delete each file in parallel for performance
      const deletePromises = fileList.items.map((fileRef) =>
        deleteObject(fileRef)
      );
      await Promise.all(deletePromises);
    } catch (storageError) {
      console.error("Error al eliminar archivos:", storageError);
      // Critical: If file deletion fails, abort the entire operation
      return NextResponse.json(
        {
          success: false,
          error: "Error al eliminar los archivos asociados al trámite",
        },
        { status: 500 }
      );
    }

    // Step 2: Only if files were deleted successfully, delete the contract from database
    const response = await tursoClient.execute({
      sql: `DELETE FROM tramites WHERE id = ?`,
      args: [tramite_id],
    });

    // Check if contract was found and deleted
    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró el trámite",
        },
        { status: 404 }
      );
    }

    // Return successful response
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const totalRequestTime = performance.now() - requestStartTime;

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error(
        `[VALIDATION ERROR] Delete request failed after ${totalRequestTime.toFixed(2)}ms:`,
        error.issues
      );
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Handle general errors with original error message format
    console.error(
      `[ERROR] Contract deletion failed after ${totalRequestTime.toFixed(2)}ms:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
