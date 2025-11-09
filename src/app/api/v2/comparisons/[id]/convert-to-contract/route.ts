import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { moveFolderFromComparativasToTramites } from "@/core/firebase/data/moveFolder";
import { Client } from "@libsql/client";
import { createComparativaChange } from "@/comparativas/utils/comparativaChangesHelpers";

// ==================== TYPE DEFINITIONS ====================

/**
 * Request body schema for converting comparison to contract
 */
const ConvertToContractSchema = z.object({
  organization_id: z.string().min(1, "Organization ID is required"),
  tramite_id: z.string().min(1, "Tramite ID is required"),
  user_id: z.string().min(1, "User ID is required for tracking changes"),
});

/**
 * Response interface for conversion operation
 */
interface ConvertToContractResponse {
  success: boolean;
  error?: string;
  message?: string;
  metrics?: QueryMetrics;
}

/**
 * Performance metrics interface
 */
interface QueryMetrics {
  requestTime: number;
  operationType: string;
  filesProcessed: number;
  optimizationApplied: string[];
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Executes database query with performance monitoring and error handling
 * @param tursoClient - Database client instance
 * @param query - SQL query string
 * @param params - Query parameters
 * @param operation - Operation name for logging
 * @returns Promise with query result and metrics
 */
async function executeQuery(
  tursoClient: Client,
  query: string,
  params: (string | number)[],
  operation: string
): Promise<{
  result: { rows: Record<string, unknown>[]; rowsAffected: number };
  metrics: Partial<QueryMetrics>;
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
        requestTime: queryTime,
        operationType: operation,
        optimizationApplied: ["PREPARED_STATEMENT", "PARAMETERIZED_QUERY"],
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
 * Validates comparison existence and gets file count
 * @param tursoClient - Database client instance
 * @param comparisonId - Comparison ID to validate
 * @returns Promise with validation result and file count
 */
async function validateComparison(
  tursoClient: Client,
  comparisonId: string
): Promise<{ exists: boolean; fileCount: number }> {
  const { result } = await executeQuery(
    tursoClient,
    `SELECT COUNT(*) as file_count FROM comparativa_files WHERE comparativa_id = ?`,
    [comparisonId],
    "validate_comparison"
  );

  const fileCount = Number(result.rows[0]?.file_count) || 0;
  return {
    exists: fileCount > 0,
    fileCount,
  };
}

// ==================== MAIN ENDPOINT ====================

/**
 * Converts a comparison to contract by moving associated files
 *
 * Refactored from: /api/comparativas/move-files/[id]
 * New endpoint: /new_api/comparisons/[id]/convert-to-contract
 *
 * This endpoint handles the conversion of a comparison (comparativa) to a contract (tramite)
 * by moving all associated files from the comparison storage to the contract storage,
 * both in Firebase Storage and in the database tables.
 *
 * @param request - Next.js request object containing organization_id and tramite_id
 * @param params - Route parameters containing comparison ID
 * @returns Promise<NextResponse<ConvertToContractResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ConvertToContractResponse>> {
  const startTime = performance.now();

  try {
    // ==================== PARAMETER VALIDATION ====================

    const { id: comparisonId } = await params;

    if (!comparisonId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // ==================== REQUEST BODY VALIDATION ====================

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    // Validate request body using Zod schema
    const validation = ConvertToContractSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { organization_id, tramite_id } = validation.data;

    // ==================== DATABASE CONNECTION ====================

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

    // ==================== BUSINESS LOGIC VALIDATION ====================

    // Validate that the comparison exists and has files to move
    const { exists: comparisonExists, fileCount } = await validateComparison(
      tursoClient,
      comparisonId
    );

    if (!comparisonExists || fileCount === 0) {
      const totalRequestTime = performance.now() - startTime;

      // Return success if no files to move (maintains compatibility)
      return NextResponse.json({
        success: true,
        message: "No files to move",
        metrics: {
          requestTime: totalRequestTime,
          operationType: "conversion_no_files",
          filesProcessed: 0,
          optimizationApplied: ["EARLY_VALIDATION", "PERFORMANCE_MONITORING"],
        },
      });
    }

    // ==================== CORE CONVERSION OPERATION ====================

    // Execute the file conversion using the existing helper function
    // This maintains 100% compatibility with the original implementation
    const { success: moveFilesSuccess, error: moveFileError } =
      await moveFolderFromComparativasToTramites(
        tursoClient,
        organization_id,
        comparisonId,
        tramite_id
      );

    // ==================== RESPONSE HANDLING ====================

    const totalRequestTime = performance.now() - startTime;

    if (!moveFilesSuccess) {
      console.error(
        `[ERROR] Conversion failed for comparison ${comparisonId} after ${totalRequestTime.toFixed(2)}ms: ${moveFileError}`
      );

      return NextResponse.json(
        {
          success: false,
          error: moveFileError,
        },
        { status: 500 }
      );
    }

    // ==================== SUCCESS RESPONSE ====================

    // Track the conversion to contract
    const { user_id } = validation.data;
    await createComparativaChange(tursoClient, {
      comparativa_id: comparisonId,
      user_id: user_id,
      change_type: "converted_to_contract",
      field_name: "tramite_id",
      old_value: null,
      new_value: tramite_id,
      description: `Comparativa convertida a trámite: ${tramite_id}`,
    });

    return NextResponse.json({
      success: true,
      metrics: {
        requestTime: totalRequestTime,
        operationType: "conversion_success",
        filesProcessed: fileCount,
        optimizationApplied: [
          "INPUT_VALIDATION",
          "EARLY_VALIDATION",
          "PERFORMANCE_MONITORING",
          "ERROR_CONTEXT_LOGGING",
        ],
      },
    });
  } catch (error) {
    // ==================== ERROR HANDLING ====================

    const totalRequestTime = performance.now() - startTime;

    console.error(
      `[ERROR] Conversion operation failed after ${totalRequestTime.toFixed(2)}ms:`,
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error moving folder from comparativas to tramites",
        metrics: {
          requestTime: totalRequestTime,
          operationType: "conversion_error",
          filesProcessed: 0,
          optimizationApplied: ["ERROR_HANDLING", "PERFORMANCE_MONITORING"],
        },
      },
      { status: 500 }
    );
  }
}
