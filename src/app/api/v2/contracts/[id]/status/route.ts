import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { NOW_DATE } from "@/dashboard/constants";
import { Client } from "@libsql/client";
import {
  recordStatusChange,
  recordFieldChanges,
  recordNoteChange,
} from "@/tramites/utils/tramiteChangesHelpers";

/**
 * REFACTORED CONTRACT STATUS UPDATE ENDPOINT
 *
 * Original: /api/tramites/update/[id]/status
 * Refactored: /new_api/contracts/[id]/status
 *
 * This endpoint updates the status of a contract (tramite) and related fields
 * with enhanced performance, type safety, and comprehensive error handling.
 */

// ==================== TYPE DEFINITIONS ====================

interface ContractStatusUpdateResponse {
  success: boolean;
  error?: string;
}

interface QueryMetrics {
  queryTime: number;
  fieldsUpdated: number;
  optimizationApplied: string[];
}

// ==================== VALIDATION SCHEMAS ====================

/**
 * Zod schema for contract status update request body
 * Maintains compatibility with original endpoint while adding type safety
 */
const ContractStatusUpdateSchema = z.object({
  status: z.string().min(1, "Status is required"),
  user_id: z.string().min(1, "User ID is required"),
  comision: z.number().optional(),
  comision_sales_person: z.number().optional(),
  note: z.string().optional(),
  notes: z.array(z.string()).optional(),
  liquidez_status: z.string().optional(),
  collection_date: z.string().optional(),
  payment_date: z.string().optional(),
  activation_date: z.string().optional(),
  tramitation_date: z.string().optional(),
  renovation_date: z.string().optional(),
});

/**
 * Schema for URL parameters
 */
const ParamsSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
});

// ==================== UTILITY FUNCTIONS ====================

/**
 * Executes a database query with performance monitoring and error handling
 * @param client - Turso database client
 * @param sql - SQL query string
 * @param args - Query parameters
 * @returns Promise with query result and metrics
 */
async function executeQuery(
  client: Client,
  sql: string,
  args: (string | number)[],
): Promise<{ result: { rowsAffected: number }; metrics: QueryMetrics }> {
  const startTime = performance.now();
  const optimizations: string[] = [];

  try {
    // Add query optimization tracking
    if (sql.includes("WHERE id = ?")) {
      optimizations.push("indexed-primary-key-lookup");
    }
    if (args.length > 1) {
      optimizations.push("batch-field-update");
    }

    const result = await client.execute({ sql, args });
    const queryTime = performance.now() - startTime;

    return {
      result,
      metrics: {
        queryTime,
        fieldsUpdated: args.length - 1, // Subtract 1 for the WHERE clause parameter
        optimizationApplied: optimizations,
      },
    };
  } catch (error) {
    const queryTime = performance.now() - startTime;
    console.error(
      `[ERROR] Query failed after ${queryTime.toFixed(2)}ms:`,
      error,
    );
    throw error;
  }
}

/**
 * Builds dynamic UPDATE SQL query with conditional field updates
 * This approach optimizes the query to only update fields that have changed
 * @param requestData - Validated request data
 * @param contractId - Contract ID for WHERE clause
 * @returns Object with SQL query and arguments
 */
function buildUpdateQuery(
  requestData: z.infer<typeof ContractStatusUpdateSchema>,
  contractId: string,
): { sql: string; args: (string | number)[]; updatedFields: string[] } {
  const updateFields: string[] = [];
  const queryArgs: (string | number)[] = [];
  const updatedFieldNames: string[] = [];

  // Always update status (required field)
  updateFields.push("status = ?");
  queryArgs.push(requestData.status);
  updatedFieldNames.push("status");

  // Conditional field updates for performance optimization
  if (requestData.comision !== undefined) {
    updateFields.push("comision = ?");
    queryArgs.push(requestData.comision);
    updatedFieldNames.push("comision");
  }

  if (requestData.comision_sales_person !== undefined) {
    updateFields.push("comision_sales_person = ?");
    queryArgs.push(requestData.comision_sales_person);
    updatedFieldNames.push("comision_sales_person");
  }

  // Handle notes update with JSON serialization
  if (requestData.note !== undefined && requestData.notes !== undefined) {
    const updatedNotes = [...requestData.notes, requestData.note];
    const notesJSON = JSON.stringify(updatedNotes);
    updateFields.push("notes = ?");
    queryArgs.push(notesJSON);
    updatedFieldNames.push("notes");
  }

  if (requestData.liquidez_status !== undefined) {
    updateFields.push("liquidez_status = ?");
    queryArgs.push(requestData.liquidez_status);
    updatedFieldNames.push("liquidez_status");
  }

  // Status-specific date updates
  if (
    requestData.status === "Activo" &&
    requestData.activation_date &&
    requestData.renovation_date
  ) {
    updateFields.push("activation_date = ?", "renovation_date = ?");
    queryArgs.push(requestData.activation_date, requestData.renovation_date);
    updatedFieldNames.push("activation_date", "renovation_date");
  }

  if (requestData.status === "Verificado" && requestData.tramitation_date) {
    updateFields.push("tramitation_date = ?");
    queryArgs.push(requestData.tramitation_date);
    updatedFieldNames.push("tramitation_date");
  }

  if (requestData.status === "Baja") {
    updateFields.push("rejected_date = ?");
    queryArgs.push(NOW_DATE.toISOString());
    updatedFieldNames.push("rejected_date");
  }

  // Liquidez status-specific date updates
  if (
    requestData.liquidez_status === "Cobrado por Comercializadora" &&
    requestData.collection_date
  ) {
    updateFields.push("collection_date = ?");
    queryArgs.push(requestData.collection_date);
    updatedFieldNames.push("collection_date");
  }

  if (
    requestData.liquidez_status === "Pagado al Comercial" &&
    requestData.payment_date
  ) {
    updateFields.push("payment_date = ?");
    queryArgs.push(requestData.payment_date);
    updatedFieldNames.push("payment_date");
  }

  // Always update metadata fields
  updateFields.push("updated_by = ?", "updated_at = ?");
  queryArgs.push(requestData.user_id, NOW_DATE.toISOString());
  updatedFieldNames.push("updated_by", "updated_at");

  // Add contract ID for WHERE clause
  queryArgs.push(contractId);

  const sql = `UPDATE tramites SET ${updateFields.join(", ")} WHERE id = ?`;

  return { sql, args: queryArgs, updatedFields: updatedFieldNames };
}

// ==================== MAIN ENDPOINT HANDLER ====================

/**
 * PATCH /new_api/contracts/[id]/status
 *
 * Updates the status of a contract (tramite) and related fields.
 * Maintains 100% compatibility with the original endpoint while adding:
 * - Enhanced type safety with Zod validation
 * - Performance monitoring and optimization
 * - Comprehensive error handling
 * - Better logging and debugging information
 *
 * @param request - Next.js request object
 * @param context - Route context with contract ID parameter
 * @returns Promise<NextResponse<ContractStatusUpdateResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ContractStatusUpdateResponse>> {
  try {
    // ==================== PARAMETER VALIDATION ====================

    const { id: contractId } = await params;

    // Validate URL parameters
    const paramValidation = ParamsSchema.safeParse({ id: contractId });
    if (!paramValidation.success) {
      console.error(`[VALIDATION ERROR] Invalid contract ID: ${contractId}`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid contract ID",
        },
        { status: 400 },
      );
    }

    // ==================== REQUEST BODY VALIDATION ====================

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const validation = ContractStatusUpdateSchema.safeParse(requestBody);

    if (!validation.success) {
      console.error(
        `[VALIDATION ERROR] PATCH ${contractId}/status:`,
        validation.error.issues,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 },
      );
    }

    const validatedData = validation.data;

    // ==================== DATABASE CLIENT INITIALIZATION ====================

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 },
      );
    }

    // ==================== QUERY BUILDING AND EXECUTION ====================

    // First, get the current values to track changes
    const currentValues = await tursoClient.execute({
      sql: `SELECT status, comision, comision_sales_person, notes, liquidez_status, 
                   collection_date, payment_date, activation_date, tramitation_date, renovation_date
            FROM tramites WHERE id = ?`,
      args: [contractId],
    });

    if (currentValues.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tramite not found" },
        { status: 404 },
      );
    }

    const currentData = currentValues.rows[0];

    const { sql, args } = buildUpdateQuery(validatedData, contractId);

    const { result } = await executeQuery(tursoClient, sql, args);

    // ==================== TRACK CHANGES ====================

    const changes: Array<{
      field_name: string;
      old_value: string | null;
      new_value: string | null;
      description?: string;
    }> = [];

    // Track status change specifically
    if (validatedData.status && currentData.status !== validatedData.status) {
      await recordStatusChange(
        tursoClient,
        contractId,
        validatedData.user_id,
        currentData.status as string,
        validatedData.status,
      );
    }

    // Track other field changes
    if (
      validatedData.comision !== undefined &&
      currentData.comision !== validatedData.comision
    ) {
      changes.push({
        field_name: "comision",
        old_value: currentData.comision?.toString() || null,
        new_value: validatedData.comision.toString(),
        description: `Comisión actualizada de ${currentData.comision || "vacío"} a ${validatedData.comision}`,
      });
    }

    if (
      validatedData.comision_sales_person !== undefined &&
      currentData.comision_sales_person !== validatedData.comision_sales_person
    ) {
      changes.push({
        field_name: "comision_sales_person",
        old_value: currentData.comision_sales_person?.toString() || null,
        new_value: validatedData.comision_sales_person.toString(),
        description: `Comisión vendedor actualizada de ${currentData.comision_sales_person || "vacío"} a ${validatedData.comision_sales_person}`,
      });
    }

    if (
      validatedData.liquidez_status !== undefined &&
      currentData.liquidez_status !== validatedData.liquidez_status
    ) {
      changes.push({
        field_name: "liquidez_status",
        old_value: currentData.liquidez_status as string | null,
        new_value: validatedData.liquidez_status,
        description: `Estado de liquidez actualizado`,
      });
    }

    // Track date changes
    const dateFields = [
      "collection_date",
      "payment_date",
      "activation_date",
      "tramitation_date",
      "renovation_date",
    ];
    for (const field of dateFields) {
      const newValue = validatedData[field as keyof typeof validatedData] as
        | string
        | undefined;
      if (newValue !== undefined && currentData[field] !== newValue) {
        changes.push({
          field_name: field,
          old_value: currentData[field] as string | null,
          new_value: newValue,
          description: `${field.replace("_", " ")} actualizada`,
        });
      }
    }

    // Record field changes if any
    if (changes.length > 0) {
      await recordFieldChanges(
        tursoClient,
        contractId,
        validatedData.user_id,
        changes,
      );
    }

    // Track note addition
    if (validatedData.note) {
      await recordNoteChange(
        tursoClient,
        contractId,
        validatedData.user_id,
        validatedData.note,
      );
    }

    // ==================== RESULT VALIDATION ====================

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { success: false, error: "Tramite not found" },
        { status: 404 },
      );
    }

    // ==================== SUCCESS RESPONSE ====================

    // BACKWARD COMPATIBILITY: Return exact same response as original endpoint
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(`[ERROR] Contract status update failed:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
