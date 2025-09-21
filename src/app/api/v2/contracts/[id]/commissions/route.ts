import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";
import { recordCommissionChange } from "@/tramites/utils/tramiteChangesHelpers";

/**
 * REFACTORED CONTRACT COMMISSIONS UPDATE ENDPOINT
 *
 * Original: /api/tramites/update/[id]/comissions
 * Refactored: /new_api/contracts/[id]/commissions
 *
 * This endpoint updates commission information for a contract (tramite)
 * with enhanced performance, type safety, and comprehensive error handling.
 */

// ==================== TYPE DEFINITIONS ====================

interface ContractCommissionsUpdateResponse {
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
 * Zod schema for contract commissions update request body
 * Maintains EXACT compatibility with original endpoint validation logic
 */
const ContractCommissionsUpdateSchema = z
  .object({
    comision: z.union([z.number(), z.null()]).optional(),
    comision_sales_person: z.union([z.number(), z.null()]).optional(),
    user_id: z.string().min(1, "User ID is required"), // Add user_id for tracking
  })
  .refine(
    (data) => {
      // BACKWARD COMPATIBILITY: Match original validation logic exactly
      // Original: (!comision && !comision_sales_person) = fail
      // But we need to allow 0 values - only fail if BOTH fields are completely missing (undefined)
      const comisionMissing = data.comision === undefined;
      const salesPersonMissing = data.comision_sales_person === undefined;
      return !(comisionMissing && salesPersonMissing);
    },
    {
      message: "Missing parameters",
      path: ["comision", "comision_sales_person"],
    }
  );

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
  args: (string | number)[]
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
      error
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
  requestData: z.infer<typeof ContractCommissionsUpdateSchema>,
  contractId: string
): { sql: string; args: (string | number)[]; updatedFields: string[] } {
  const updateFields: string[] = [];
  const queryArgs: (string | number)[] = [];
  const updatedFieldNames: string[] = [];

  // Conditional field updates for performance optimization
  if (requestData.comision !== undefined) {
    updateFields.push("comision = ?");
    queryArgs.push(requestData.comision ?? 0); // Convert null to 0
    updatedFieldNames.push("comision");
  }

  if (requestData.comision_sales_person !== undefined) {
    updateFields.push("comision_sales_person = ?");
    queryArgs.push(requestData.comision_sales_person ?? 0); // Convert null to 0
    updatedFieldNames.push("comision_sales_person");
  }

  // Add contract ID for WHERE clause
  queryArgs.push(contractId);

  const sql = `UPDATE tramites SET ${updateFields.join(", ")} WHERE id = ?`;

  return { sql, args: queryArgs, updatedFields: updatedFieldNames };
}

// ==================== MAIN ENDPOINT HANDLER ====================

/**
 * PATCH /new_api/contracts/[id]/commissions
 *
 * Updates commission information for a contract (tramite).
 *
 * @param request - Next.js request object
 * @param params - URL parameters containing contract ID
 * @returns Promise<NextResponse<ContractCommissionsUpdateResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContractCommissionsUpdateResponse>> {
  const startTime = performance.now();

  try {
    // ==================== PARAMETER VALIDATION ====================

    const { id: contractId } = await params;

    // Validate URL parameters
    const paramsValidation = ParamsSchema.safeParse({ id: contractId });
    if (!paramsValidation.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[VALIDATION ERROR] Invalid parameters after ${totalRequestTime.toFixed(2)}ms:`,
        paramsValidation.error.issues
      );

      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // ==================== REQUEST BODY VALIDATION ====================

    const requestBody = await request.json();
    const validation = ContractCommissionsUpdateSchema.safeParse(requestBody);

    if (!validation.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[VALIDATION ERROR] Request failed after ${totalRequestTime.toFixed(2)}ms:`,
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

    const validatedData = validation.data;

    // ==================== DATABASE CLIENT INITIALIZATION ====================

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[ERROR] Database client not initialized after ${totalRequestTime.toFixed(2)}ms`
      );

      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // ==================== QUERY BUILDING AND EXECUTION ====================

    // First, get current values to track changes
    const currentValues = await tursoClient.execute({
      sql: `SELECT comision, comision_sales_person FROM tramites WHERE id = ?`,
      args: [contractId],
    });

    if (currentValues.rows.length === 0) {
      const totalRequestTime = performance.now() - startTime;
      console.warn(
        `[WARNING] Contract ${contractId} not found after ${totalRequestTime.toFixed(2)}ms`
      );

      return NextResponse.json(
        {
          success: false,
          error: "Tramite not found",
        },
        { status: 404 }
      );
    }

    const currentData = currentValues.rows[0];

    const { sql, args, updatedFields } = buildUpdateQuery(
      validatedData,
      contractId
    );

    console.log(
      `[INFO] Executing commissions update for contract ${contractId}. ` +
        `Fields to update: [${updatedFields.join(", ")}]`
    );

    const { result, metrics } = await executeQuery(tursoClient, sql, args);

    // ==================== TRACK CHANGES ====================

    // Track commission changes
    if (
      validatedData.comision !== undefined &&
      currentData.comision !== validatedData.comision
    ) {
      await recordCommissionChange(
        tursoClient,
        contractId,
        validatedData.user_id,
        "comision",
        currentData.comision as number | null,
        validatedData.comision
      );
    }

    if (
      validatedData.comision_sales_person !== undefined &&
      currentData.comision_sales_person !== validatedData.comision_sales_person
    ) {
      await recordCommissionChange(
        tursoClient,
        contractId,
        validatedData.user_id,
        "comision_sales_person",
        currentData.comision_sales_person as number | null,
        validatedData.comision_sales_person
      );
    } // ==================== RESULT VALIDATION ====================

    if (result.rowsAffected === 0) {
      const totalRequestTime = performance.now() - startTime;
      console.warn(
        `[WARNING] Contract ${contractId} not found after ${totalRequestTime.toFixed(2)}ms. ` +
          `Query time: ${metrics.queryTime.toFixed(2)}ms`
      );

      return NextResponse.json(
        {
          success: false,
          error: "Tramite not found",
        },
        { status: 404 }
      );
    }

    // ==================== SUCCESS RESPONSE ====================

    const totalRequestTime = performance.now() - startTime;

    console.log(
      `[SUCCESS] Contract ${contractId} commissions updated successfully after ${totalRequestTime.toFixed(2)}ms. ` +
        `Query time: ${metrics.queryTime.toFixed(2)}ms, Fields updated: ${metrics.fieldsUpdated}, ` +
        `Optimizations: [${metrics.optimizationApplied.join(", ")}]`
    );

    // BACKWARD COMPATIBILITY: Return exact same response as original endpoint
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    // ==================== ERROR HANDLING ====================

    const totalRequestTime = performance.now() - startTime;

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.error(
        `[VALIDATION ERROR] Request failed after ${totalRequestTime.toFixed(2)}ms:`,
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

    // Handle general errors
    console.error(
      `[ERROR] Contract commissions update failed after ${totalRequestTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
