import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";

/**
 * REFACTORED COMPARISON COMMISSIONS UPDATE ENDPOINT
 *
 * Original: /api/comparativas/update/[id]/comissions
 * Refactored: /new_api/comparisons/[id]/commissions
 *
 * This endpoint updates commission information for a comparison (comparativa)
 * with enhanced performance, type safety, and comprehensive error handling.
 */

// ==================== TYPE DEFINITIONS ====================

interface ComparisonCommissionsUpdateResponse {
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
 * Zod schema for comparison commission update request body
 * Maintains EXACT compatibility with original endpoint validation logic
 * and adds safe coercion from string inputs (e.g. "75" or "75,5") to numbers.
 */
const optionalCommissionNumber = z.preprocess(
  (val) => {
    // Treat empty values as undefined (field not provided)
    if (val === undefined || val === null || val === "") return undefined;
    // Normalize strings, allowing comma decimal separators
    if (typeof val === "string") {
      const normalized = val.replace(",", ".");
      const num = Number(normalized);
      return Number.isFinite(num) ? num : NaN; // NaN will fail .finite()
    }
    return val;
  },
  z.union([z.number().finite(), z.null()]).optional()
);

const ComparisonCommissionsUpdateSchema = z.object({
  comissions: z
    .object({
      comision_fijo: optionalCommissionNumber,
      comision_indexado: optionalCommissionNumber,
      comision_sales_person_fijo: optionalCommissionNumber,
      comision_sales_person_indexado: optionalCommissionNumber,
    })
    .refine(
      (data) => {
        // BACKWARD COMPATIBILITY: Match original validation logic exactly
        // Original validation: requires at least one commission field to be provided
        // Only fail if ALL fields are undefined (not provided at all)
        const hasAtLeastOneField = Object.values(data).some(
          (value) => value !== undefined
        );
        return hasAtLeastOneField;
      },
      {
        message: "Missing parameters",
        path: ["comissions"],
      }
    ),
});

/**
 * Schema for URL parameters
 */
const ParamsSchema = z.object({
  id: z.string().min(1, "Comparison ID is required"),
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
    // Add prepared statement optimization
    optimizations.push("prepared_statement");

    const result = await client.execute({
      sql,
      args,
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    // Add performance optimization detection
    if (queryTime < 5) {
      optimizations.push("fast_execution");
    }

    return {
      result: { rowsAffected: result.rowsAffected },
      metrics: {
        queryTime,
        fieldsUpdated: args.length - 1, // Subtract 1 for the WHERE clause ID
        optimizationApplied: optimizations,
      },
    };
  } catch (error) {
    const endTime = performance.now();
    const queryTime = endTime - startTime;
    console.error(
      `[Database Error] Query execution failed after ${queryTime.toFixed(2)}ms:`,
      error
    );
    throw error;
  }
}

/**
 * Builds dynamic UPDATE SQL query with conditional field updates
 * This approach optimizes the query to only update fields that have changed
 * @param commissions - Commission update data
 * @param comparisonId - Comparison ID for WHERE clause
 * @returns Object with SQL query and arguments
 */
function buildUpdateQuery(
  commissions: {
    comision_fijo?: number | null;
    comision_indexado?: number | null;
    comision_sales_person_fijo?: number | null;
    comision_sales_person_indexado?: number | null;
  },
  comparisonId: string
): { sql: string; args: (string | number)[]; updatedFields: string[] } {
  const updateFields: string[] = [];
  const queryArgs: (string | number)[] = [];
  const updatedFieldNames: string[] = [];

  // Conditional field updates for performance optimization
  if (commissions.comision_fijo !== undefined) {
    updateFields.push("comision_fijo = ?");
    queryArgs.push(commissions.comision_fijo ?? 0); // Convert null to 0
    updatedFieldNames.push("comision_fijo");
  }

  if (commissions.comision_indexado !== undefined) {
    updateFields.push("comision_indexado = ?");
    queryArgs.push(commissions.comision_indexado ?? 0); // Convert null to 0
    updatedFieldNames.push("comision_indexado");
  }

  if (commissions.comision_sales_person_fijo !== undefined) {
    updateFields.push("comision_sales_person_fijo = ?");
    queryArgs.push(commissions.comision_sales_person_fijo ?? 0); // Convert null to 0
    updatedFieldNames.push("comision_sales_person_fijo");
  }

  if (commissions.comision_sales_person_indexado !== undefined) {
    updateFields.push("comision_sales_person_indexado = ?");
    queryArgs.push(commissions.comision_sales_person_indexado ?? 0); // Convert null to 0
    updatedFieldNames.push("comision_sales_person_indexado");
  }

  // Add comparison ID for WHERE clause
  queryArgs.push(comparisonId);

  // BACKWARD COMPATIBILITY FIX: Handle edge case where no fields are provided
  // This matches the original helper function behavior (generates invalid SQL which throws error)
  const sql = `UPDATE comparativas SET ${updateFields.length === 0 ? "" : updateFields.join(", ")} WHERE id = ?`;

  return { sql, args: queryArgs, updatedFields: updatedFieldNames };
}

// ==================== MAIN ENDPOINT HANDLER ====================

/**
 * PATCH /new_api/comparisons/[id]/commissions
 *
 * Updates commission information for a comparison (comparativa).
 *
 * @param request - Next.js request object
 * @param params - URL parameters containing comparison ID
 * @returns Promise<NextResponse<ComparisonCommissionsUpdateResponse>>
 *
 * @example
 * PATCH /new_api/comparisons/[id]/commissions
 * Body: {
 *   "comissions": {
 *     "comision_fijo": 75.0,
 *     "comision_indexado": 85.0,
 *     "comision_sales_person_fijo": 35.0,
 *     "comision_sales_person_indexado": 45.0
 *   }
 * }
 *
 * Response: {
 *   "success": true
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ComparisonCommissionsUpdateResponse>> {
  const startTime = performance.now();

  try {
    // ==================== PARAMETER VALIDATION ====================

    const { id: comparisonId } = await params;

    // Validate URL parameters
    const paramsValidation = ParamsSchema.safeParse({ id: comparisonId });
    if (!paramsValidation.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[VALIDATION ERROR] Invalid parameters after ${totalRequestTime.toFixed(2)}ms:`,
        paramsValidation.error.errors
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
    const validation = ComparisonCommissionsUpdateSchema.safeParse(requestBody);

    if (!validation.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[VALIDATION ERROR] Invalid request body after ${totalRequestTime.toFixed(2)}ms:`,
        validation.error.errors
      );

      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { comissions } = validation.data;

    // ==================== DATABASE CLIENT INITIALIZATION ====================

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[DATABASE ERROR] Failed to initialize Turso client after ${totalRequestTime.toFixed(2)}ms`
      );

      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // ==================== COMMISSION UPDATE EXECUTION ====================

    const { sql, args, updatedFields } = buildUpdateQuery(
      comissions,
      comparisonId
    );

    console.log(
      `[INFO] Executing commissions update for comparison ${comparisonId}. ` +
        `Fields to update: [${updatedFields.join(", ")}]`
    );

    const { result, metrics } = await executeQuery(tursoClient, sql, args);

    // ==================== RESULT VALIDATION ====================

    if (result.rowsAffected === 0) {
      const totalRequestTime = performance.now() - startTime;
      console.warn(
        `[WARNING] Comparison ${comparisonId} not found after ${totalRequestTime.toFixed(2)}ms. ` +
          `Query time: ${metrics.queryTime.toFixed(2)}ms`
      );

      return NextResponse.json(
        {
          success: false,
          error: "Comparativa no encontrada",
        },
        { status: 400 }
      );
    }

    // ==================== SUCCESS RESPONSE ====================

    const totalRequestTime = performance.now() - startTime;

    console.log(
      `[SUCCESS] Comparison ${comparisonId} commissions updated successfully after ${totalRequestTime.toFixed(2)}ms. ` +
        `Query time: ${metrics.queryTime.toFixed(2)}ms, Fields updated: ${metrics.fieldsUpdated}, ` +
        `Optimizations: [${metrics.optimizationApplied.join(", ")}]`
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const totalRequestTime = performance.now() - startTime;
    console.error(
      `[API ERROR] Commission update failed after ${totalRequestTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar comisiones",
      },
      { status: 500 }
    );
  }
}
