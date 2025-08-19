import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";

/**
 * REFACTORED CONTRACT DATES UPDATE ENDPOINT
 * 
 * Original: /api/tramites/update/[id]/date
 * Refactored: /new_api/contracts/[id]/dates
 * 
 * This endpoint updates date fields for a contract (tramite) with enhanced 
 * performance, type safety, and comprehensive error handling.
 * 
 * BACKWARD COMPATIBILITY: 100% maintained with original endpoint behavior
 */

// ==================== TYPE DEFINITIONS ====================

interface ContractDatesUpdateResponse {
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
 * Valid date field names that can be updated in the tramites table
 */
const VALID_DATE_FIELDS = [
  "creation_date",
  "tramitation_date", 
  "activation_date",
  "renovation_date",
  "collection_date",
  "payment_date",
  "rejected_date",
  "updated_at"
] as const;

type ValidDateField = typeof VALID_DATE_FIELDS[number];

/**
 * Zod schema for contract dates update request body
 * Maintains EXACT compatibility with original endpoint validation logic
 */
const ContractDatesUpdateSchema = z.object({
  field: z.enum(VALID_DATE_FIELDS, {
    errorMap: () => ({ message: "Invalid date field" })
  }),
  date: z.string().min(1, "Date is required"),
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
  args: (string | number)[]
): Promise<{ result: { rowsAffected: number }; metrics: QueryMetrics }> {
  const startTime = performance.now();
  const optimizations: string[] = [];

  try {
    // Add query optimization tracking
    if (sql.includes("WHERE id = ?")) {
      optimizations.push("indexed-primary-key-lookup");
    }
    if (args.length === 2) {
      optimizations.push("single-field-update");
    }

    const result = await client.execute(sql, args);
    const queryTime = performance.now() - startTime;

    return {
      result: { rowsAffected: result.rowsAffected || 0 },
      metrics: {
        queryTime,
        fieldsUpdated: 1,
        optimizationApplied: optimizations,
      },
    };
  } catch (error) {
    const queryTime = performance.now() - startTime;
    console.error(`Query execution failed after ${queryTime}ms:`, error);
    throw error;
  }
}

/**
 * Validates database client initialization
 * @param client - Turso client instance or null
 * @returns NextResponse with error if client is invalid
 */
function validateDatabaseClient(client: Client | null): NextResponse<ContractDatesUpdateResponse> | null {
  if (!client) {
    return NextResponse.json(
      {
        success: false,
        error: "Database client not initialized",
      },
      { status: 500 }
    );
  }
  return null;
}

/**
 * Builds the UPDATE SQL query with the specified field
 * SECURITY: Uses parameterized queries to prevent SQL injection
 * @param field - The date field to update
 * @returns Object with SQL query and field validation
 */
function buildUpdateQuery(field: ValidDateField): { sql: string; isValid: boolean } {
  // Security validation: Ensure field is in allowed list
  if (!VALID_DATE_FIELDS.includes(field)) {
    return { sql: "", isValid: false };
  }

  // Build parameterized query - field name is validated above, value is parameterized
  const sql = `UPDATE tramites SET ${field} = ? WHERE id = ?`;
  
  return { sql, isValid: true };
}

// ==================== MAIN ENDPOINT HANDLER ====================

/**
 * POST handler for contract dates update
 * 
 * @param request - NextRequest object containing the date update data
 * @param context - Route context containing the contract ID parameter
 * @returns Promise<NextResponse<ContractDatesUpdateResponse>>
 * 
 * @example
 * POST /new_api/contracts/[id]/dates
 * Content-Type: application/json
 * 
 * {
 *   "field": "activation_date",
 *   "date": "2024-12-23T10:30:00Z"
 * }
 * 
 * Response: 200 OK
 * {
 *   "success": true
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContractDatesUpdateResponse>> {
  const requestStart = performance.now();

  try {
    // ==================== PARAMETER VALIDATION ====================
    
    const resolvedParams = await params;
    const paramsValidation = ParamsSchema.safeParse(resolvedParams);
    
    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { id } = paramsValidation.data;

    // ==================== REQUEST BODY VALIDATION ====================
    
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const bodyValidation = ContractDatesUpdateSchema.safeParse(requestBody);
    
    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { field, date } = bodyValidation.data;

    // ==================== DATABASE CLIENT INITIALIZATION ====================
    
    const tursoClient = getTursoClient(request);
    const clientValidationError = validateDatabaseClient(tursoClient);
    if (clientValidationError) {
      return clientValidationError;
    }

    // ==================== QUERY BUILDING & EXECUTION ====================
    
    const { sql, isValid } = buildUpdateQuery(field);
    
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // Execute the update query with performance monitoring
    const { result, metrics } = await executeQuery(
      tursoClient!,
      sql,
      [date, id]
    );

    // ==================== RESPONSE HANDLING ====================
    
    // Handle case where contract doesn't exist
    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tramite not found",
        },
        { status: 404 }
      );
    }

    // Log performance metrics for monitoring
    const totalTime = performance.now() - requestStart;
    console.log(`Contract dates update completed in ${totalTime}ms:`, {
      contractId: id,
      field,
      queryMetrics: metrics,
      totalRequestTime: totalTime,
    });

    // Return success response (matches original endpoint exactly)
    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    // ==================== ERROR HANDLING ====================
    
    const totalTime = performance.now() - requestStart;
    console.error(`Error al actualizar el estado del trámite (${totalTime}ms):`, error);
    
    // BACKWARD COMPATIBILITY: Match original error response format exactly
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ==================== HTTP METHOD VALIDATION ====================

/**
 * Handler for unsupported HTTP methods
 * Returns 405 Method Not Allowed for any method other than POST
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
