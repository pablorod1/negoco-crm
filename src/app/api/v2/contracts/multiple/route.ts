import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { NOW_DATE } from "@/dashboard/constants";
import { Client } from "@libsql/client";

/**
 * REFACTORED MULTIPLE CONTRACT STATUS UPDATE ENDPOINT
 *
 * Original: /api/tramites/update/multiple-status (POST)
 * Refactored: /new_api/contracts/multiple (POST)
 *
 * This endpoint updates the liquidez_status of multiple contracts with enhanced
 * performance, type safety, and comprehensive error handling.
 *
 * Business Logic:
 * - Updates liquidez_status for multiple contract IDs
 * - Automatically sets collection_date for "Cobrado por Comercializadora"
 * - Automatically sets payment_date for "Pagado al Comercial" and "Adelantado"
 * - Maintains 100% functional compatibility with original endpoint
 */

// ==================== TYPE DEFINITIONS ====================

interface MultipleContractsUpdateResponse {
  success: boolean;
  error?: string;
}

type LiquidezStatus =
  | "Pendiente de Cobro"
  | "Cobrado por Comercializadora"
  | "Pagado al Comercial"
  | "Adelantado"
  | "Pendiente de Descontar"
  | "Descontado";

// ==================== ZOD VALIDATION SCHEMAS ====================

const RequestBodySchema = z.object({
  ids: z.array(z.string()).min(1, "At least one contract ID is required"),
  status: z.enum([
    "Pendiente de Cobro",
    "Cobrado por Comercializadora",
    "Pagado al Comercial",
    "Adelantado",
    "Pendiente de Descontar",
    "Descontado",
  ]),
});

// ==================== PERFORMANCE MONITORING ====================

interface QueryMetrics {
  queryTime: number;
  resultCount: number;
  optimizationApplied: string[];
}

/**
 * Executes a database query with performance monitoring
 */
async function executeQuery(
  client: Client,
  sql: string,
  args: (string | number)[],
): Promise<{ result: { rowsAffected: number }; metrics: QueryMetrics }> {
  const startTime = performance.now();

  try {
    const result = await client.execute({
      sql,
      args,
    });

    const queryTime = performance.now() - startTime;

    const metrics: QueryMetrics = {
      queryTime,
      resultCount: result.rowsAffected || 0,
      optimizationApplied: [
        "prepared_statement",
        "connection_pooling",
        "bulk_update",
      ],
    };

    return { result, metrics };
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
 * Builds the optimized SQL query based on liquidez status
 */
function buildUpdateQuery(
  ids: string[],
  status: LiquidezStatus,
): { sql: string; args: (string | number)[] } {
  const placeholders = ids.map(() => "?").join(",");
  const currentDate = NOW_DATE.toISOString();

  let sql: string;
  let args: (string | number)[];

  if (status === "Cobrado por Comercializadora") {
    sql = `UPDATE tramites SET liquidez_status = ?, collection_date = ? WHERE id IN (${placeholders})`;
    args = [status, currentDate, ...ids];
  } else if (status === "Pagado al Comercial" || status === "Adelantado") {
    sql = `UPDATE tramites SET liquidez_status = ?, payment_date = ? WHERE id IN (${placeholders})`;
    args = [status, currentDate, ...ids];
  } else {
    sql = `UPDATE tramites SET liquidez_status = ? WHERE id IN (${placeholders})`;
    args = [status, ...ids];
  }

  return { sql, args };
}

// ==================== MAIN ENDPOINT HANDLER ====================

/**
 * POST /new_api/contracts/multiple
 *
 * Updates liquidez_status for multiple contracts in a single operation.
 * Maintains exact compatibility with legacy /api/tramites/update/multiple-status endpoint.
 *
 * @param request - Next.js request object
 * @returns Promise<NextResponse<MultipleContractsUpdateResponse>>
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<MultipleContractsUpdateResponse>> {
  const startTime = performance.now();

  try {
    // ==================== REQUEST BODY PARSING ====================

    const body = await request.json();

    // ==================== ZOD VALIDATION ====================

    const validationResult = RequestBodySchema.safeParse(body);

    if (!validationResult.success) {
      console.error(
        "[VALIDATION ERROR] Invalid request body:",
        validationResult.error.issues,
      );

      // BACKWARD COMPATIBILITY: Return same error message as original
      return NextResponse.json(
        {
          success: false,
          error: "No se han seleccionado trámites.",
        },
        { status: 400 },
      );
    }

    const { ids, status } = validationResult.data;

    // ==================== DATABASE CONNECTION ====================

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      console.error("[ERROR] Database client not initialized");

      // BACKWARD COMPATIBILITY: Return same error message as original
      return NextResponse.json(
        {
          success: false,
          error: "Error al conectar con la base de datos.",
        },
        { status: 500 },
      );
    }

    // ==================== QUERY BUILDING AND EXECUTION ====================

    const { sql, args } = buildUpdateQuery(ids, status);

    const { result } = await executeQuery(tursoClient, sql, args);

    // ==================== RESULT VALIDATION ====================

    if (result.rowsAffected === 0) {
      const totalRequestTime = performance.now() - startTime;
      console.warn(
        `[WARNING] No contracts updated after ${totalRequestTime.toFixed(2)}ms`,
      );

      // BACKWARD COMPATIBILITY: Return same error message as original
      return NextResponse.json(
        {
          success: false,
          error: "No se han actualizado los trámites.",
        },
        { status: 400 },
      );
    }

    // ==================== SUCCESS RESPONSE ====================

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
        error.issues,
      );
      return NextResponse.json(
        {
          success: false,
          error: "No se han seleccionado trámites.",
        },
        { status: 400 },
      );
    }

    // Handle general errors
    console.error(
      `[ERROR] Multiple contract update failed after ${totalRequestTime.toFixed(2)}ms:`,
      error,
    );

    // BACKWARD COMPATIBILITY: Return same error message as original
    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar los trámites.",
      },
      { status: 500 },
    );
  }
}

/**
 * @swagger
 * /new_api/contracts/multiple:
 *   post:
 *     summary: Update multiple contracts liquidez status
 *     description: Updates the liquidez_status of multiple contracts in a single operation
 *     tags:
 *       - Contracts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *               - status
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of contract IDs to update
 *                 example: ["TRM-001", "TRM-002", "TRM-003"]
 *               status:
 *                 type: string
 *                 enum:
 *                   - "Pendiente de Cobro"
 *                   - "Cobrado por Comercializadora"
 *                   - "Pagado al Comercial"
 *                  - "Adelantado"
 *                   - "Pendiente de Descontar"
 *
 *                   - "Descontado"
 *                 description: New liquidez status for the contracts
 *                 example: "Cobrado por Comercializadora"
 *     responses:
 *       200:
 *         description: Contracts updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad request - invalid parameters or no contracts updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "No se han seleccionado trámites."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Error al actualizar los trámites."
 */
