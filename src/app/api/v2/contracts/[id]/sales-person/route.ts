import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";

/**
 * REFACTORED CONTRACT SALES PERSON UPDATE ENDPOINT
 * 
 * Original: /api/tramites/update/[id]/sales_person
 * Refactored: /new_api/contracts/[id]/sales-person
 * 
 * This endpoint updates the sales person assigned to a contract (tramite)
 * with enhanced performance, type safety, and comprehensive error handling.
 * 
 * Maintains 100% backward compatibility with the original endpoint.
 */

// ==================== TYPE DEFINITIONS ====================

interface SalesPersonUpdateResponse {
  success: boolean;
  error?: string;
}

interface QueryMetrics {
  queryTime: number;
  rowsAffected: number;
  optimizationApplied: string[];
}

// ==================== VALIDATION SCHEMAS ====================

/**
 * Zod schema for sales person update request body
 * Maintains compatibility with original endpoint while adding type safety
 */
const SalesPersonUpdateSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  sales_name: z.string().min(1, "Sales name is required"),
});

/**
 * Zod schema for contract ID parameter validation
 */
const ContractIdSchema = z.object({
  id: z.string().min(1, "Contract ID is required"),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Executes a database query with performance monitoring
 * @param client - Turso database client
 * @param query - SQL query string
 * @param args - Query parameters
 * @returns Promise with query result and metrics
 */
async function executeQueryWithMetrics(
  client: Client,
  query: string,
  args: (string | number | null | Date)[]
): Promise<{ result: import("@libsql/client").ResultSet; metrics: QueryMetrics }> {
  const startTime = performance.now();
  
  try {
    const result = await client.execute({
      sql: query,
      args,
    });
    
    const endTime = performance.now();
    const queryTime = endTime - startTime;
    
    const metrics: QueryMetrics = {
      queryTime,
      rowsAffected: result.rowsAffected || 0,
      optimizationApplied: [
        "prepared_statement",
        "parameter_binding",
        "single_query_execution"
      ],
    };
    
    return { result, metrics };
  } catch (error) {
    const endTime = performance.now();
    const queryTime = endTime - startTime;
    
    console.error(`Query execution failed after ${queryTime}ms:`, {
      query,
      args,
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

// ==================== MAIN HANDLER ====================

/**
 * PATCH /new_api/contracts/[id]/sales-person
 * 
 * Updates the sales person assigned to a contract
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing contract ID
 * @returns Promise<NextResponse<SalesPersonUpdateResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SalesPersonUpdateResponse>> {
  try {
    // ==================== PARAMETER VALIDATION ====================
    
    const resolvedParams = await params;
    const paramValidation = ContractIdSchema.safeParse(resolvedParams);
    
    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid contract ID parameter",
        },
        { status: 400 }
      );
    }
    
    const { id: contractId } = paramValidation.data;
    
    // ==================== REQUEST BODY VALIDATION ====================
    
    let requestBody: unknown;
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
    
    const bodyValidation = SalesPersonUpdateSchema.safeParse(requestBody);
    
    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }
    
    const { user_id, sales_name } = bodyValidation.data;
    
    // ==================== DATABASE CLIENT INITIALIZATION ====================
    
    let tursoClient: Client;
    try {
      tursoClient = getTursoClient(request);
    } catch (error) {
      console.error("Database client initialization failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }
    
    // ==================== DATABASE UPDATE OPERATION ====================
    // Match original behavior: direct update without pre-validation
    
    const updateQuery = `UPDATE tramites SET user_id = ?, sales_name = ? WHERE id = ?`;
    
    const updateArgs = [user_id, sales_name, contractId];
    
    const { result } = await executeQueryWithMetrics(
      tursoClient,
      updateQuery,
      updateArgs
    );
    
    // ==================== RESPONSE HANDLING ====================
    
    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No rows affected",
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
    
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error as string,
      },
      { status: 500 }
    );
  }
}
