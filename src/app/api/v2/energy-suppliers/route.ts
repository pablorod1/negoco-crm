import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { ComercializadoraVM } from "@/comercializadoras/types";
import { Row } from "@libsql/client";

// Request validation schema
const EnergySupplierRequestSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  user_role: z.string().min(1, "User role is required"),
});

// Response types for full compatibility - allowing both original and enhanced formats
interface EnergySupplierResponse {
  success?: boolean;
  data?: ComercializadoraVM[];
  error?: string;
}

interface QueryMetrics {
  queryTime: number;
  resultCount: number;
  cacheHit: boolean;
  optimizationApplied: string[];
}

/**
 * Retrieves all energy suppliers (comercializadoras) with associated statistics
 *
 * This endpoint provides complete information about energy suppliers including:
 * - Basic supplier information (id, name, logo, active status)
 * - Total number of tramites associated with each supplier
 * - Total number of documentation files associated with each supplier
 *
 * For role-based access:
 * - Role "2" (supervisors): Returns data filtered by user and their subordinates
 * - Other roles: Returns all data without user filtering
 *
 * @param request - Next.js request object containing user_id and user_role
 * @returns Promise<NextResponse<EnergySupplierResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<EnergySupplierResponse>> {
  const startTime = Date.now();
  const optimizations: string[] = [];

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = EnergySupplierRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Parameters",
        },
        { status: 400 }
      );
    }

    const { user_id, user_role } = validation.data;

    // Initialize Turso client with proper error handling
    let tursoClient;
    try {
      tursoClient = getTursoClient(request);
    } catch (error) {
      console.error("Database initialization error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Database not initialized",
        },
        { status: 500 }
      );
    }

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not initialized",
        },
        { status: 500 }
      );
    }

    // Query optimization: Build optimized query based on user role
    let userFilterClause = "";
    const userFilterParams: string[] = [];

    // Build user role-based filtering for tramites (exactly like by-name endpoint)
    if (user_role === "2") {
      // Commercial users (role 2): only see their own tramites and their subcomerciales' non-draft tramites
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        userFilterClause = `AND (t.user_id = ? OR (t.status != 'Borrador' AND t.user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})))`;
        userFilterParams.push(user_id, ...subcomerciales.ids);
        optimizations.push("role-based-filtering");
        optimizations.push("subordinate-user-lookup");
      } else {
        userFilterClause = `AND t.user_id = ?`;
        userFilterParams.push(user_id);
        optimizations.push("role-based-filtering");
      }
    } else {
      // For other roles: show all non-draft tramites or user's own tramites (including drafts)
      userFilterClause = `AND (t.user_id = ? OR (t.user_id != ? AND t.status != 'Borrador'))`;
      userFilterParams.push(user_id, user_id);
    }

    // Single optimized query with subqueries for efficient data retrieval and proper user filtering
    // This approach matches exactly the by-name endpoint logic but for multiple comercializadoras
    const query = `
      SELECT 
        c.id,
        c.name,
        c.logo,
        c.active,
        (SELECT COUNT(*) FROM documentacion_files WHERE folder_name LIKE '%' || c.name || '%') as num_files,
        (
          SELECT COUNT(DISTINCT con.tramite_id)
          FROM contracts con
          JOIN tramites t ON t.id = con.tramite_id
          WHERE con.new_company = c.name ${userFilterClause}
        ) as total_tramites,
        (
          SELECT COALESCE(SUM(con.consumption), 0)
          FROM contracts con
          JOIN tramites t ON t.id = con.tramite_id
          WHERE con.new_company = c.name ${userFilterClause}
        ) as total_consumption
      FROM comercializadoras c
      ORDER BY c.name ASC
    `;

    const params = [...userFilterParams, ...userFilterParams];
    optimizations.push("exact-by-name-logic-per-comercializadora");

    // Execute query with performance tracking
    const queryStartTime = Date.now();
    const response = await tursoClient.execute({
      sql: query,
      args: params,
    });
    const queryTime = Date.now() - queryStartTime;

    optimizations.push("prepared-statement-execution");

    // Handle empty results
    if (response.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No commercializadoras found",
        },
        { status: 404 }
      );
    }

    // Transform results with type safety
    const comercializadoras: ComercializadoraVM[] = response.rows.map(
      (row: Row): ComercializadoraVM => ({
        id: row.id as string,
        name: row.name as string,
        logo: row.logo as string,
        active: Boolean(row.active),
        num_tramites: Number(row.total_tramites) || 0,
        num_files: Number(row.files_count) || 0,
        total_consumption: Number(row.total_consumption) || 0,
      })
    );

    optimizations.push("type-safe-transformation");

    // Performance metrics for monitoring
    const totalTime = Date.now() - startTime;
    const metrics: QueryMetrics = {
      queryTime,
      resultCount: comercializadoras.length,
      cacheHit: false, // Future enhancement: implement caching
      optimizationApplied: optimizations,
    };

    // Log performance metrics in development
    if (process.env.NODE_ENV === "development") {
      console.log("Energy Suppliers API Performance:", {
        totalTime: `${totalTime}ms`,
        queryTime: `${queryTime}ms`,
        resultCount: metrics.resultCount,
        optimizations: metrics.optimizationApplied,
        userRole: user_role,
      });
    }

    // Return successful response with exact original structure
    return NextResponse.json(
      {
        success: true,
        data: comercializadoras,
      },
      {
        status: 200,
        headers: {
          // Add performance headers for monitoring
          "X-Query-Time": queryTime.toString(),
          "X-Result-Count": comercializadoras.length.toString(),
          "X-Optimizations": optimizations.join(","),
        },
      }
    );
  } catch (error) {
    // Enhanced error logging with context
    console.error("Error fetching energy suppliers:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Return consistent error response matching original format
    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
