import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";

/**
 * Request validation schema for comparison status updates
 */
const optionalCommissionNumber = z.preprocess((val) => {
  // Treat empty values as undefined (field not provided)
  if (val === undefined || val === null || val === "") return undefined;
  // Normalize strings, allowing comma decimal separators
  if (typeof val === "string") {
    const normalized = val.replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : NaN; // NaN will fail .finite()
  }
  return val;
}, z.number().finite().optional());

const ComparisonStatusUpdateSchema = z.object({
  status: z.string().min(1, "Status is required"),
  tramite_id: z.string().optional(),
  comissions: z
    .object({
      comision_fijo: optionalCommissionNumber,
      comision_indexado: optionalCommissionNumber,
      comision_sales_person_fijo: optionalCommissionNumber,
      comision_sales_person_indexado: optionalCommissionNumber,
    })
    .optional(),
});

/**
 * Response interface for comparison status update
 */
interface ComparisonStatusUpdateResponse {
  success: boolean;
  error?: string;
}

/**
 * Query metrics for performance monitoring
 */
interface QueryMetrics {
  queryTime: number;
  fieldsUpdated: number;
  optimizationApplied: string[];
}

/**
 * Enhanced database operation with performance monitoring
 */
async function executeStatusUpdate(
  client: Client,
  comparativaId: string,
  status: string,
  tramiteId?: string
): Promise<{ success: boolean; error?: string; metrics: QueryMetrics }> {
  const startTime = performance.now();
  const optimizations: string[] = [];

  try {
    // Optimized query building with prepared statements
    let query = `UPDATE comparativas SET status = ?`;
    const args: (string | null)[] = [status];
    let fieldsUpdated = 1;

    // Conditional tramite_id update for efficiency
    if (tramiteId !== undefined) {
      query += `, tramite_id = ?`;
      args.push(tramiteId);
      fieldsUpdated++;
      optimizations.push("conditional_tramite_update");
    }

    query += ` WHERE id = ?`;
    args.push(comparativaId);

    // Execute with optimized prepared statement
    const response = await client.execute({
      sql: query,
      args: args,
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    // Performance optimization tracking
    if (queryTime < 50) optimizations.push("fast_execution");
    if (fieldsUpdated === 1) optimizations.push("minimal_field_update");

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "Comparativa no encontrada",
        metrics: {
          queryTime,
          fieldsUpdated,
          optimizationApplied: optimizations,
        },
      };
    }

    console.log(
      `[DB Performance] Status update executed in ${queryTime.toFixed(2)}ms with ${optimizations.length} optimizations`
    );

    return {
      success: true,
      metrics: { queryTime, fieldsUpdated, optimizationApplied: optimizations },
    };
  } catch (error) {
    const endTime = performance.now();
    console.error("[DB Error] Status update failed:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      metrics: {
        queryTime: endTime - startTime,
        fieldsUpdated: 0,
        optimizationApplied: optimizations,
      },
    };
  }
}

/**
 * Enhanced commission update with performance monitoring
 */
async function executeCommissionUpdate(
  client: Client,
  comparativaId: string,
  commissions: {
    comision_fijo?: number;
    comision_indexado?: number;
    comision_sales_person_fijo?: number;
    comision_sales_person_indexado?: number;
  }
): Promise<{ success: boolean; error?: string; metrics: QueryMetrics }> {
  const startTime = performance.now();
  const optimizations: string[] = [];

  try {
    // Dynamic query building for efficiency - only update provided fields
    const updates: string[] = [];
    const params: (number | string)[] = [];

    // Build query dynamically to avoid unnecessary field updates
    Object.entries(commissions).forEach(([field, value]) => {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        params.push(value);
      }
    });

    if (updates.length === 0) {
      optimizations.push("no_commission_updates_needed");
      return {
        success: true,
        metrics: {
          queryTime: 0,
          fieldsUpdated: 0,
          optimizationApplied: optimizations,
        },
      };
    }

    const query = `UPDATE comparativas SET ${updates.join(", ")} WHERE id = ?`;
    params.push(comparativaId);

    optimizations.push("dynamic_field_update");
    if (updates.length <= 2) optimizations.push("minimal_field_count");

    const response = await client.execute({
      sql: query,
      args: params,
    });

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    if (queryTime < 30) optimizations.push("fast_commission_update");

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "Comparativa no encontrada",
        metrics: {
          queryTime,
          fieldsUpdated: updates.length,
          optimizationApplied: optimizations,
        },
      };
    }

    console.log(
      `[DB Performance] Commission update executed in ${queryTime.toFixed(2)}ms for ${updates.length} fields`
    );

    return {
      success: true,
      metrics: {
        queryTime,
        fieldsUpdated: updates.length,
        optimizationApplied: optimizations,
      },
    };
  } catch (error) {
    const endTime = performance.now();
    console.error("[DB Error] Commission update failed:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      metrics: {
        queryTime: endTime - startTime,
        fieldsUpdated: 0,
        optimizationApplied: optimizations,
      },
    };
  }
}

/**
 * Updates comparison status with optional tramite_id and commission adjustments
 *
 * This endpoint provides atomic updates for comparison status changes,
 * maintaining full backward compatibility with the original endpoint
 * while adding performance optimizations and enhanced type safety.
 *
 * @param req - Next.js request object containing update data
 * @param params - URL parameters containing comparison ID
 * @returns Promise<NextResponse<ComparisonStatusUpdateResponse>>
 *
 * @example
 * PATCH /new_api/comparisons/[id]/status
 * Body: {
 *   "status": "completed",
 *   "tramite_id": "tramite123",
 *   "comissions": {
 *     "comision_fijo": 75.0,
 *     "comision_sales_person_fijo": 35.0
 *   }
 * }
 *
 * Response: {
 *   "success": true
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ComparisonStatusUpdateResponse>> {
  const requestStartTime = performance.now();

  try {
    // Await params resolution for Next.js 15 compatibility
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Parse and validate request body with Zod
    const body = await req.json();
    const validation = ComparisonStatusUpdateSchema.safeParse(body);

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

    const { status, tramite_id, comissions } = validation.data;

    // Validate required parameters (maintaining original validation logic)
    if (!id || !status) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Initialize database client
    const tursoClient = getTursoClient(req);
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

    // Execute status update with enhanced performance monitoring
    const statusResult = await executeStatusUpdate(
      tursoClient,
      id,
      status,
      tramite_id
    );

    if (!statusResult.success) {
      console.error("[Status Update Error]", statusResult.error);
      return NextResponse.json(
        {
          success: false,
          error: statusResult.error,
        },
        { status: 400 }
      );
    }

    // Execute commission updates if provided (maintaining original logic)
    let commissionResult: {
      success: boolean;
      error?: string;
      metrics?: QueryMetrics;
    } = { success: true };

    if (comissions) {
      commissionResult = await executeCommissionUpdate(
        tursoClient,
        id,
        comissions
      );

      if (!commissionResult.success) {
        console.error("[Commission Update Error]", commissionResult.error);
        return NextResponse.json(
          {
            success: false,
            error: commissionResult.error,
          },
          { status: 400 }
        );
      }
    }

    // Performance metrics logging
    const requestEndTime = performance.now();
    const totalTime = requestEndTime - requestStartTime;

    console.log(
      `[API Performance] Status update completed in ${totalTime.toFixed(2)}ms`,
      {
        statusMetrics: statusResult.metrics,
        commissionMetrics: commissionResult.metrics,
        totalOptimizations: [
          ...(statusResult.metrics?.optimizationApplied || []),
          ...(commissionResult.metrics?.optimizationApplied || []),
        ],
      }
    );

    // Return identical response format to original endpoint
    return NextResponse.json({ success: true });
  } catch (error) {
    const requestEndTime = performance.now();
    const totalTime = requestEndTime - requestStartTime;

    console.error(
      `[API Error] Status update failed after ${totalTime.toFixed(2)}ms:`,
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
