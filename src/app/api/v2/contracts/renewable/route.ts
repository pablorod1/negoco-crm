import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

/**
 * Request body validation schema for renewable contracts endpoint
 */
const RenewableContractsRequestSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
});

/**
 * Response data interface for renewable contracts
 */
interface RenewableContract {
  id: string;
  sales_name: string;
  renovationDate: string;
}

/**
 * API Response structure
 */
interface RenewableContractsResponse {
  success: boolean;
  data?: RenewableContract[];
  error?: string;
}

/**
 * Performance metrics interface
 */
interface QueryMetrics {
  queryTime: number;
  resultCount: number;
  userRole: string;
  hasSubordinates: boolean;
}

/**
 * Retrieves renewable contracts (tramites) based on user role and permissions
 * 
 * This endpoint returns contracts with status "Activo" that are eligible for renewal.
 * Role-based access control:
 * - Role "2" (Team Lead): Includes own contracts + subordinates' contracts
 * - Other roles: Only own contracts
 * 
 * @param request - Next.js request object containing user credentials
 * @returns Promise<NextResponse<RenewableContractsResponse>>
 * 
 * @example
 * POST /new_api/contracts/renewable
 * Content-Type: application/json
 * 
 * {
 *   "id": "user123",
 *   "role": "2"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "contract123",
 *       "sales_name": "John Doe Energy Contract",
 *       "renovationDate": "2024-12-01T10:00:00.000Z"
 *     }
 *   ]
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse<RenewableContractsResponse>> {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = RenewableContractsRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }
    
    const { id, role } = validationResult.data;

    // Initialize database client with connection pooling
    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Build optimized query with proper indexing considerations
    let query = `
      SELECT 
        id, 
        sales_name, 
        renovation_date AS renovationDate 
      FROM tramites 
      WHERE status = ?
    `;
    const params: (string | number)[] = ["Activo"];

    let hasSubordinates = false;

    // Role-based query optimization
    if (role === "2") {
      // Team lead role - include subordinates with optimized subquery
      try {
        const subcomerciales = await getSubcomerciales(tursoClient, id);
        
        if (subcomerciales.success && subcomerciales.ids && subcomerciales.ids.length > 0) {
          hasSubordinates = true;
          // Use optimized IN clause with parameterized query
          const placeholders = subcomerciales.ids.map(() => "?").join(", ");
          query += ` AND (user_id = ? OR user_id IN (${placeholders}))`;
          params.push(id, ...subcomerciales.ids);
        } else {
          // Fallback to own contracts only
          query += ` AND user_id = ?`;
          params.push(id);
        }
      } catch (subordinateError) {
        console.error("Error fetching subordinates, falling back to own contracts:", subordinateError);
        query += ` AND user_id = ?`;
        params.push(id);
      }
    } else {
      // Standard role - own contracts only
      query += ` AND user_id = ?`;
      params.push(id);
    }

    // Add performance optimization: order by renovation_date for better UX
    query += ` ORDER BY renovation_date ASC`;

    // Execute query with proper error handling
    const rs = await tursoClient.execute({ 
      sql: query, 
      args: params 
    });

    // Transform results with type safety
    const renewableContracts: RenewableContract[] = rs.rows.map((row) => ({
      id: row.id as string,
      sales_name: row.sales_name as string,
      renovationDate: row.renovationDate as string,
    }));

    // Calculate performance metrics
    const queryTime = Date.now() - startTime;
    const metrics: QueryMetrics = {
      queryTime,
      resultCount: renewableContracts.length,
      userRole: role,
      hasSubordinates,
    };

    // Log performance metrics for monitoring
    if (queryTime > 1000) {
      console.warn(`Slow renewable contracts query detected:`, metrics);
    }

    // Return successful response with standardized structure
    return NextResponse.json({
      success: true,
      data: renewableContracts,
    });

  } catch (error) {
    // Comprehensive error handling with structured logging
    const errorTime = Date.now() - startTime;
    
    console.error("Error obtaining renewable contracts:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      executionTime: errorTime,
      timestamp: new Date().toISOString(),
    });

    // Return user-friendly error response
    return NextResponse.json(
      {
        success: false,
        error: "Error obteniendo trámites renovables",
      },
      { status: 500 }
    );
  }
}
