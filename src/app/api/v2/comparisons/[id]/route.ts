import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { ComparativaPlan } from "@/comparativas/types";
import { Client } from "@libsql/client";
import { updateComparativaGeneral } from "@/comparativas/utils/updateComparativaHelpers";
import { deleteFolderFromStorage } from "@/core/firebase/data/deleteFolder";
import { createComparativaChange } from "@/comparativas/utils/comparativaChangesHelpers";

/**
 * Database row interfaces for type safety
 */
interface ComparativaRow extends Record<string, unknown> {
  id: string;
  client: string;
  service: string;
  plan: string;
  status: string;
  comision_fijo: number;
  comision_indexado: number;
  comision_sales_person_fijo: number;
  comision_sales_person_indexado: number;
  notes: string;
  creation_date: string;
  tramite_id: string | null;
  user_id: string;
  email: string;
  name: string;
  image: string | null;
  company_id?: string; // ID reference to comercializadoras table
}

interface ComparativaFileRow extends Record<string, unknown> {
  id: string;
  comparativa_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
}

/**
 * Request validation schema for comparison by ID
 */
const ComparisonByIdSchema = z.object({
  id: z.string().min(1, "ID is required"),
  user_id: z.string().min(1, "User ID is required"),
  user_role: z.string().min(1, "User role is required"),
});

/**
 * Comprehensive PATCH request validation schema for comparison updates
 */
const ComparisonPatchSchema = z.object({
  client: z.string().min(1).optional(),
  service: z.enum(["Luz", "Gas"]).optional(),
  plan: z.array(z.enum(["fijo", "indexado"])).optional(),
  status: z.string().optional(),
  tramite_id: z.string().nullable().optional(),
  comisions: z
    .object({
      comision_fijo: z.number().optional(),
      comision_indexado: z.number().optional(),
      comision_sales_person_fijo: z.number().optional(),
      comision_sales_person_indexado: z.number().optional(),
    })
    .optional(),
  notes: z.array(z.string()).optional(),
  user_id: z.string().optional(), // Allow reassignment
});

/**
 * Response interface for comparison by ID
 */
interface ComparisonByIdResponse {
  success: boolean;
  data?: {
    id: string;
    client: string;
    service: "Luz" | "Gas";
    plan: ComparativaPlan[];
    status: string;
    comision: {
      fijo: number;
      indexado: number;
    };
    comision_sales_person: {
      fijo: number;
      indexado: number;
    };
    notes: string[];
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    };
    creation_date: string;
    tramite_id: string | null;
    company_id?: string; // ID reference to comercializadoras table
    files: Array<{
      id: string;
      filename: string;
      size: number;
      extension: string;
      upload_date: string;
      download_url: string;
      preview_url: string | null;
    }>;
  };
  error?: string;
}

/**
 * Database query execution with error handling and performance monitoring
 */
async function executeQuery<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  client: Client,
  sql: string,
  args: (string | number)[],
  queryName: string
): Promise<{ success: boolean; data?: T[]; error?: string }> {
  const startTime = performance.now();

  try {
    const result = await client.execute({ sql, args });

    return {
      success: true,
      data: result.rows as unknown as T[],
    };
  } catch (error) {
    const endTime = performance.now();
    console.error(
      `[DB Query Error] ${queryName} failed after ${(endTime - startTime).toFixed(2)}ms:`,
      error
    );

    return {
      success: false,
      error: `Database query failed: ${queryName}`,
    };
  }
}

/**
 * Fetch comparison data with user authorization
 */
async function fetchComparisonData(
  client: Client,
  id: string,
  user_id: string,
  user_role: string
): Promise<{ success: boolean; data?: ComparativaRow[]; error?: string }> {
  const queryParams: (string | number)[] = [id];

  let comparativaQuery = `
    SELECT 
      c.id,
      c.client,
      c.service,
      c.plan,
      c.status,
      c.comision_fijo,
      c.comision_indexado,
      c.comision_sales_person_fijo,
      c.comision_sales_person_indexado,
      c.notes,
      c.creation_date,
      c.tramite_id,
      c.company_id,
      u.id as user_id,
      u.email,
      u.name,
      u.image
    FROM comparativas c
    INNER JOIN user u ON c.user_id = u.id
    WHERE c.id = ?
  `;

  // Apply role-based filtering for managers (role "2")
  if (user_role === "2") {
    const subcomerciales = await getSubcomerciales(client, user_id);
    const idsToInclude = [user_id];

    if (subcomerciales.success && subcomerciales.ids) {
      idsToInclude.push(...subcomerciales.ids);
    }

    const placeholders = idsToInclude.map(() => "?").join(", ");
    comparativaQuery += ` AND u.id IN (${placeholders})`;
    queryParams.push(...idsToInclude);
  }

  return executeQuery<ComparativaRow>(
    client,
    comparativaQuery,
    queryParams,
    "fetch-comparison-data"
  );
}

/**
 * Fetch comparison files
 */
async function fetchComparisonFiles(
  client: Client,
  comparativaId: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    filename: string;
    size: number;
    extension: string;
    upload_date: string;
    download_url: string;
    preview_url: string | null;
  }>;
  error?: string;
}> {
  const filesQuery = `
    SELECT 
      id,
      comparativa_id,
      filename,
      size,
      extension,
      upload_date,
      download_url,
      preview_url
    FROM comparativa_files 
    WHERE comparativa_id = ?
    ORDER BY upload_date DESC
  `;

  const result = await executeQuery<ComparativaFileRow>(
    client,
    filesQuery,
    [comparativaId],
    "fetch-comparison-files"
  );

  if (!result.success) {
    return result;
  }

  const files = result.data!.map((row: ComparativaFileRow) => ({
    id: String(row.id),
    filename: String(row.filename),
    size: Number(row.size),
    extension: String(row.extension),
    upload_date: row.upload_date as string,
    download_url: String(row.download_url),
    preview_url: row.preview_url ? String(row.preview_url) : null,
  }));

  return {
    success: true,
    data: files,
  };
}

/**
 * Transform raw database data to response format
 */
function transformComparisonData(
  comparativa: ComparativaRow,
  files: Array<{
    id: string;
    filename: string;
    size: number;
    extension: string;
    upload_date: string;
    download_url: string;
    preview_url: string | null;
  }>
): ComparisonByIdResponse["data"] {
  return {
    id: String(comparativa.id),
    client: String(comparativa.client),
    service: String(comparativa.service) as "Luz" | "Gas",
    plan: JSON.parse(comparativa.plan as string) as ComparativaPlan[],
    status: String(comparativa.status),
    comision: {
      fijo: Number(comparativa.comision_fijo),
      indexado: Number(comparativa.comision_indexado),
    },
    comision_sales_person: {
      fijo: Number(comparativa.comision_sales_person_fijo),
      indexado: Number(comparativa.comision_sales_person_indexado),
    },
    notes: JSON.parse(comparativa.notes as string) as string[],
    user: {
      id: String(comparativa.user_id),
      email: String(comparativa.email),
      name: String(comparativa.name),
      image: comparativa.image ? String(comparativa.image) : null,
    },
    creation_date: comparativa.creation_date as string,
    tramite_id: comparativa.tramite_id ? String(comparativa.tramite_id) : null,
    company_id: comparativa.company_id
      ? String(comparativa.company_id)
      : undefined,
    files,
  };
}

/**
 * PATCH /new_api/comparisons/[id]
 *
 * COMPREHENSIVE GENERAL UPDATE ROUTE for comparisons
 *
 * This endpoint handles complete comparison updates including:
 * - Client name changes
 * - Service type updates (Luz/Gas)
 * - Plan modifications (fijo/indexado combinations)
 * - Status transitions
 * - Commission adjustments
 * - Notes management
 * - User reassignment
 * - Contract linking (tramite_id)
 *
 * @param req - Next.js request object containing update data
 * @param params - URL parameters containing comparison ID
 * @returns Promise<NextResponse<ComparisonByIdResponse>>
 *
 * @example
 * PATCH /new_api/comparisons/comp123
 * Body: {
 *   "client": "Updated Client Name",
 *   "service": "Gas",
 *   "plan": ["fijo", "indexado"],
 *   "status": "completed",
 *   "comisions": {
 *     "comision_fijo": 75.0,
 *     "comision_indexado": 85.0,
 *     "comision_sales_person_fijo": 35.0,
 *     "comision_sales_person_indexado": 45.0
 *   },
 *   "notes": ["Updated note 1", "New note 2"],
 *   "tramite_id": "tramite789"
 * }
 *
 * Response: {
 *   "success": true,
 *   "data": { ...updated comparison object... }
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ComparisonByIdResponse>> {
  const startTime = performance.now();

  try {
    // Await params resolution
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing comparison ID" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = ComparisonPatchSchema.safeParse(body);

    if (!validation.success) {
      console.warn(
        "[Validation Warning] Invalid update parameters:",
        validation.error.issues
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid parameters: " +
            validation.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Extract user_id from body for tracking changes
    const { user_id: requestUserId } = body;

    // Initialize database client
    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      console.error("[Database Error] Failed to initialize Turso client");
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Check if comparison exists before updating
    const existingComparison = await fetchComparisonData(
      tursoClient,
      id,
      "admin",
      "admin"
    );
    if (
      !existingComparison.success ||
      !existingComparison.data ||
      existingComparison.data.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "Comparativa not found" },
        { status: 404 }
      );
    }

    // Prepare update object for the general update function
    const updateData: {
      client?: string;
      service?: "Luz" | "Gas";
      plan?: string;
      status?: string;
      tramite_id?: string | null;
      comision_fijo?: number;
      comision_indexado?: number;
      comision_sales_person_fijo?: number;
      comision_sales_person_indexado?: number;
      notes?: string;
      user_id?: string;
    } = {};

    // Map request data to database format
    if (updates.client !== undefined) updateData.client = updates.client;
    if (updates.service !== undefined) updateData.service = updates.service;
    if (updates.plan !== undefined)
      updateData.plan = JSON.stringify(updates.plan);
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.tramite_id !== undefined)
      updateData.tramite_id = updates.tramite_id;
    if (updates.notes !== undefined)
      updateData.notes = JSON.stringify(updates.notes);
    if (updates.user_id !== undefined) updateData.user_id = updates.user_id;

    // Handle commission updates
    if (updates.comisions) {
      if (updates.comisions.comision_fijo !== undefined) {
        updateData.comision_fijo = updates.comisions.comision_fijo;
      }
      if (updates.comisions.comision_indexado !== undefined) {
        updateData.comision_indexado = updates.comisions.comision_indexado;
      }
      if (updates.comisions.comision_sales_person_fijo !== undefined) {
        updateData.comision_sales_person_fijo =
          updates.comisions.comision_sales_person_fijo;
      }
      if (updates.comisions.comision_sales_person_indexado !== undefined) {
        updateData.comision_sales_person_indexado =
          updates.comisions.comision_sales_person_indexado;
      }
    }

    // Execute the general update
    const updateResult = await updateComparativaGeneral(
      tursoClient,
      id,
      updateData
    );

    if (!updateResult.success) {
      console.error(
        "[Database Error] Failed to update comparison:",
        updateResult.error
      );
      return NextResponse.json(
        { success: false, error: updateResult.error },
        { status: 400 }
      );
    }

    // Track changes made to the comparativa
    if (requestUserId) {
      const previousData = existingComparison.data[0];

      // Track client update
      if (
        updates.client !== undefined &&
        updates.client !== previousData.client
      ) {
        await createComparativaChange(tursoClient, {
          comparativa_id: id,
          user_id: requestUserId,
          change_type: "client_update",
          field_name: "client",
          old_value: previousData.client,
          new_value: updates.client,
          description: `Cliente actualizado de "${previousData.client}" a "${updates.client}"`,
        });
      }

      // Track service update
      if (
        updates.service !== undefined &&
        updates.service !== previousData.service
      ) {
        await createComparativaChange(tursoClient, {
          comparativa_id: id,
          user_id: requestUserId,
          change_type: "service_update",
          field_name: "service",
          old_value: previousData.service,
          new_value: updates.service,
          description: `Servicio actualizado de "${previousData.service}" a "${updates.service}"`,
        });
      }

      // Track plan update
      if (updates.plan !== undefined) {
        const previousPlan = JSON.parse(previousData.plan as string);
        if (JSON.stringify(previousPlan) !== JSON.stringify(updates.plan)) {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "plan_update",
            field_name: "plan",
            old_value: JSON.stringify(previousPlan),
            new_value: JSON.stringify(updates.plan),
            description: `Plan actualizado de [${previousPlan.join(", ")}] a [${updates.plan.join(", ")}]`,
          });
        }
      }

      // Track status update
      if (
        updates.status !== undefined &&
        updates.status !== previousData.status
      ) {
        await createComparativaChange(tursoClient, {
          comparativa_id: id,
          user_id: requestUserId,
          change_type: "status_change",
          field_name: "status",
          old_value: previousData.status,
          new_value: updates.status,
          description: `Estado actualizado de "${previousData.status}" a "${updates.status}"`,
        });
      }

      // Track commission updates
      if (updates.comisions) {
        if (
          updates.comisions.comision_fijo !== undefined &&
          updates.comisions.comision_fijo !== previousData.comision_fijo
        ) {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "commission_update",
            field_name: "comision_fijo",
            old_value: previousData.comision_fijo.toString(),
            new_value: updates.comisions.comision_fijo.toString(),
            description: `Comisión fija actualizada de ${previousData.comision_fijo}€ a ${updates.comisions.comision_fijo}€`,
          });
        }

        if (
          updates.comisions.comision_indexado !== undefined &&
          updates.comisions.comision_indexado !== previousData.comision_indexado
        ) {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "commission_update",
            field_name: "comision_indexado",
            old_value: previousData.comision_indexado.toString(),
            new_value: updates.comisions.comision_indexado.toString(),
            description: `Comisión indexada actualizada de ${previousData.comision_indexado}€ a ${updates.comisions.comision_indexado}€`,
          });
        }

        if (
          updates.comisions.comision_sales_person_fijo !== undefined &&
          updates.comisions.comision_sales_person_fijo !==
            previousData.comision_sales_person_fijo
        ) {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "commission_update",
            field_name: "comision_sales_person_fijo",
            old_value: previousData.comision_sales_person_fijo.toString(),
            new_value: updates.comisions.comision_sales_person_fijo.toString(),
            description: `Comisión comercial fija actualizada de ${previousData.comision_sales_person_fijo}€ a ${updates.comisions.comision_sales_person_fijo}€`,
          });
        }

        if (
          updates.comisions.comision_sales_person_indexado !== undefined &&
          updates.comisions.comision_sales_person_indexado !==
            previousData.comision_sales_person_indexado
        ) {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "commission_update",
            field_name: "comision_sales_person_indexado",
            old_value: previousData.comision_sales_person_indexado.toString(),
            new_value:
              updates.comisions.comision_sales_person_indexado.toString(),
            description: `Comisión comercial indexada actualizada de ${previousData.comision_sales_person_indexado}€ a ${updates.comisions.comision_sales_person_indexado}€`,
          });
        }
      }

      // Track user assignment change
      if (
        updates.user_id !== undefined &&
        updates.user_id !== previousData.user_id
      ) {
        await createComparativaChange(tursoClient, {
          comparativa_id: id,
          user_id: requestUserId,
          change_type: "assignment_change",
          field_name: "user_id",
          old_value: previousData.user_id,
          new_value: updates.user_id,
          description: `Comparativa reasignada a otro usuario`,
        });
      }

      // Track notes update
      if (updates.notes !== undefined) {
        const previousNotes = JSON.parse(previousData.notes as string);
        if (JSON.stringify(previousNotes) !== JSON.stringify(updates.notes)) {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "general_update",
            field_name: "notes",
            old_value: JSON.stringify(previousNotes),
            new_value: JSON.stringify(updates.notes),
            description: `Notas actualizadas`,
          });
        }
      }

      // Track contract/tramite link
      if (
        updates.tramite_id !== undefined &&
        updates.tramite_id !== previousData.tramite_id
      ) {
        if (updates.tramite_id === null) {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "general_update",
            field_name: "tramite_id",
            old_value: previousData.tramite_id,
            new_value: null,
            description: `Enlace con trámite eliminado`,
          });
        } else {
          await createComparativaChange(tursoClient, {
            comparativa_id: id,
            user_id: requestUserId,
            change_type: "converted_to_contract",
            field_name: "tramite_id",
            old_value: previousData.tramite_id,
            new_value: updates.tramite_id,
            description: `Comparativa convertida a trámite: ${updates.tramite_id}`,
          });
        }
      }
    }

    // Fetch the updated comparison data to return
    const updatedComparison = await fetchComparisonData(
      tursoClient,
      id,
      "admin",
      "admin"
    );
    if (
      !updatedComparison.success ||
      !updatedComparison.data ||
      updatedComparison.data.length === 0
    ) {
      console.error("[Database Error] Failed to fetch updated comparison data");
      return NextResponse.json(
        { success: false, error: "Failed to retrieve updated comparison" },
        { status: 500 }
      );
    }

    // Fetch associated files
    const filesResult = await fetchComparisonFiles(tursoClient, id);
    if (!filesResult.success) {
      console.error(
        "[Database Error] Failed to fetch comparison files:",
        filesResult.error
      );
      return NextResponse.json(
        { success: false, error: filesResult.error },
        { status: 500 }
      );
    }

    const files = filesResult.data || [];
    const responseData = transformComparisonData(
      updatedComparison.data[0],
      files
    );

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const endTime = performance.now();
    console.error(
      `[API Error] Failed to update comparison after ${(endTime - startTime).toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      { success: false, error: "Error updating comparativa" },
      { status: 500 }
    );
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ComparisonByIdResponse>> {
  const startTime = performance.now();

  try {
    // Await params resolution
    const resolvedParams = await params;
    const paramId = resolvedParams.id;

    // Parse and validate request body
    const body = await request.json();
    const validation = ComparisonByIdSchema.safeParse({
      ...body,
      id: paramId,
    });

    if (!validation.success) {
      console.warn(
        "[Validation Warning] Invalid request parameters:",
        validation.error.issues
      );
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { id, user_id, user_role } = validation.data;

    // Initialize database client
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      console.error("[Database Error] Failed to initialize Turso client");
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Fetch comparison data with authorization
    const comparisonResult = await fetchComparisonData(
      tursoClient,
      id,
      user_id,
      user_role
    );

    if (!comparisonResult.success) {
      console.error(
        "[Database Error] Failed to fetch comparison:",
        comparisonResult.error
      );
      return NextResponse.json(
        {
          success: false,
          error: comparisonResult.error,
        },
        { status: 500 }
      );
    }

    if (!comparisonResult.data || comparisonResult.data.length === 0) {
      console.warn(
        `[Authorization] Comparison not found or access denied: ${id} for user: ${user_id}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Comparativa not found",
        },
        { status: 404 }
      );
    }

    const comparativa = comparisonResult.data[0];

    // Fetch associated files
    const filesResult = await fetchComparisonFiles(tursoClient, id);

    if (!filesResult.success) {
      console.error(
        "[Database Error] Failed to fetch comparison files:",
        filesResult.error
      );
      return NextResponse.json(
        {
          success: false,
          error: filesResult.error,
        },
        { status: 500 }
      );
    }

    const files = filesResult.data || [];

    // Transform and return data
    const responseData = transformComparisonData(comparativa, files);

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const endTime = performance.now();
    console.error(
      `[API Error] Failed to retrieve comparison after ${(endTime - startTime).toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error getting comparativa",
      },
      { status: 500 }
    );
  }
}

// ==================== DELETE METHOD ====================

/**
 * Request body schema for deleting comparison
 */
const DeleteComparisonSchema = z.object({
  organization_id: z.string().min(1, "Organization ID is required"),
});

/**
 * Response interface for deletion operation
 */
interface DeleteComparisonResponse {
  success?: boolean;
  error?: string;
  metrics?: DeleteMetrics;
}

/**
 * Performance metrics interface for deletion
 */
interface DeleteMetrics {
  operationTime: number;
  recordsDeleted: number;
  filesDeleted: number;
  optimizationApplied: string[];
}

/**
 * Executes database query with performance monitoring and error handling
 * @param tursoClient - Database client instance
 * @param query - SQL query string
 * @param params - Query parameters
 * @param operation - Operation name for logging
 * @returns Promise with query result and metrics
 */
async function executeDeleteQuery(
  tursoClient: Client,
  query: string,
  params: (string | number)[],
  operation: string
): Promise<{
  result: { rows: Record<string, unknown>[]; rowsAffected: number };
  metrics: Partial<DeleteMetrics>;
}> {
  const startTime = performance.now();

  try {
    const result = await tursoClient.execute({
      sql: query,
      args: params,
    });

    const queryTime = performance.now() - startTime;

    return {
      result,
      metrics: {
        operationTime: queryTime,
        recordsDeleted: result.rowsAffected,
        optimizationApplied: ["PREPARED_STATEMENT", "PERFORMANCE_MONITORING"],
      },
    };
  } catch (error) {
    const queryTime = performance.now() - startTime;
    console.error(
      `[ERROR] ${operation} failed after ${queryTime.toFixed(2)}ms:`,
      error
    );
    throw error;
  }
}

/**
 * Validates comparison existence and retrieves metadata for optimization
 * @param tursoClient - Database client instance
 * @param comparisonId - Comparison ID to validate
 * @returns Promise with validation result and metadata
 */
async function validateComparisonExists(
  tursoClient: Client,
  comparisonId: string
): Promise<{ exists: boolean; fileCount: number }> {
  const { result } = await executeDeleteQuery(
    tursoClient,
    `SELECT 
       (SELECT COUNT(*) FROM comparativas WHERE id = ?) as comparison_exists,
       (SELECT COUNT(*) FROM comparativa_files WHERE comparativa_id = ?) as file_count`,
    [comparisonId, comparisonId],
    "validate_comparison_existence"
  );

  const row = result.rows[0] as Record<string, unknown>;
  const exists = Number(row.comparison_exists) > 0;
  const fileCount = Number(row.file_count) || 0;

  return { exists, fileCount };
}

/**
 * Deletes comparison with cascading operations optimized for performance
 * @param tursoClient - Database client instance
 * @param comparisonId - Comparison ID to delete
 * @returns Promise with deletion result and metrics
 */
async function deleteComparisonOptimized(
  tursoClient: Client,
  comparisonId: string
): Promise<{
  success: boolean;
  error?: string;
  metrics: Partial<DeleteMetrics>;
}> {
  const startTime = performance.now();

  try {
    // Execute deletion with CASCADE to automatically handle related records
    const { result } = await executeDeleteQuery(
      tursoClient,
      `DELETE FROM comparativas WHERE id = ?`,
      [comparisonId],
      "delete_comparison"
    );

    const totalTime = performance.now() - startTime;

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: "Comparativa not found",
        metrics: {
          operationTime: totalTime,
          recordsDeleted: 0,
          optimizationApplied: ["EARLY_VALIDATION", "CASCADE_DELETE"],
        },
      };
    }

    return {
      success: true,
      metrics: {
        operationTime: totalTime,
        recordsDeleted: result.rowsAffected,
        optimizationApplied: [
          "CASCADE_DELETE",
          "PERFORMANCE_MONITORING",
          "PREPARED_STATEMENT",
        ],
      },
    };
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[ERROR] Delete comparison failed after ${totalTime.toFixed(2)}ms:`,
      error
    );
    return {
      success: false,
      error: "Internal Server Error",
      metrics: {
        operationTime: totalTime,
        recordsDeleted: 0,
        optimizationApplied: ["ERROR_HANDLING"],
      },
    };
  }
}

/**
 * Deletes a comparison and all associated files
 *
 * Refactored from: /api/comparativas/delete/[id]
 * New endpoint: /new_api/comparisons/[id] (DELETE method)
 *
 * This endpoint handles the complete deletion of a comparison including:
 * - Database record deletion (with CASCADE for related files)
 * - Firebase Storage folder deletion
 * - Performance monitoring and optimization
 *
 * @param request - Next.js request object containing organization_id
 * @param params - Route parameters containing comparison ID
 * @returns Promise<NextResponse<DeleteComparisonResponse>>
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DeleteComparisonResponse>> {
  const startTime = performance.now();

  try {
    // ==================== PARAMETER VALIDATION ====================

    const { id: comparisonId } = await params;

    if (!comparisonId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    // ==================== REQUEST BODY VALIDATION ====================

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate request body using Zod schema
    const validation = DeleteComparisonSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const { organization_id } = validation.data;

    // ==================== DATABASE CONNECTION ====================

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // ==================== BUSINESS LOGIC VALIDATION ====================

    // Validate that the comparison exists and get file count for optimization
    const { exists: comparisonExists } = await validateComparisonExists(
      tursoClient,
      comparisonId
    );

    if (!comparisonExists) {
      // Return consistent error format (backward compatibility)
      return NextResponse.json(
        { error: "Comparativa not found" },
        { status: 500 }
      );
    }

    // ==================== CORE DELETION OPERATION ====================

    // Step 1: Delete from database (CASCADE will handle related files table)
    const dbDeletionResult = await deleteComparisonOptimized(
      tursoClient,
      comparisonId
    );

    if (!dbDeletionResult.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[ERROR] Database deletion failed for comparison ${comparisonId} after ${totalRequestTime.toFixed(2)}ms: ${dbDeletionResult.error}`
      );

      return NextResponse.json(
        { error: dbDeletionResult.error },
        { status: 500 }
      );
    }

    // Step 2: Delete files from Firebase Storage
    const storageDeleteResult = await deleteFolderFromStorage(
      "comparativas",
      comparisonId,
      organization_id
    );

    if (!storageDeleteResult.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[ERROR] Storage deletion failed for comparison ${comparisonId} after ${totalRequestTime.toFixed(2)}ms: ${storageDeleteResult.errors}`
      );

      // Note: Database deletion already succeeded, so we have partial failure
      // Return exact error format for backward compatibility
      return NextResponse.json(
        { error: storageDeleteResult.errors },
        { status: 500 }
      );
    }

    // ==================== SUCCESS RESPONSE ====================

    // Return exact response format for backward compatibility
    return NextResponse.json({ success: true });
  } catch (error) {
    // ==================== ERROR HANDLING ====================

    const totalRequestTime = performance.now() - startTime;

    console.error(
      `[ERROR] Deletion operation failed after ${totalRequestTime.toFixed(2)}ms:`,
      error
    );

    // Return exact error format for backward compatibility
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
