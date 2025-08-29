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
    let query: string;
    const params: (string | number)[] = [];

    if (user_role === "2") {
      // Fetch subordinates for supervisor role
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      const subIds =
        subcomerciales.success && subcomerciales.ids ? subcomerciales.ids : [];

      optimizations.push("role-based-filtering");
      optimizations.push("subordinate-user-lookup");

      // Optimized query for role "2" with exact original logic
      query = `
        SELECT 
          c.id,
          c.name,
          c.logo,
          c.active,
          COUNT(DISTINCT df.id) AS files_count,
          COUNT(DISTINCT CASE 
            WHEN con.tramite_id IS NOT NULL AND (
              t.user_id = ? ${subIds.length > 0 ? `OR t.user_id IN (${subIds.map(() => "?").join(", ")})` : ""}
            ) THEN con.tramite_id 
          END) AS total_tramites,
          COALESCE(SUM(CASE 
            WHEN con.tramite_id IS NOT NULL AND con.new_company = c.name AND (
              t.user_id = ? ${subIds.length > 0 ? `OR t.user_id IN (${subIds.map(() => "?").join(", ")})` : ""}
            ) THEN con.consumption 
            ELSE 0 
          END), 0) AS total_consumption
        FROM 
          comercializadoras c
        LEFT JOIN 
          contracts con ON con.new_company = c.name
        LEFT JOIN 
          tramites t ON t.id = con.tramite_id
        LEFT JOIN 
          documentacion_files df ON df.folder_name LIKE '%' || c.name || '%'
        GROUP BY 
          c.id, c.name, c.logo, c.active
        ORDER BY 
          c.name ASC
      `;

      // Match original parameter order: user_id, then subIds (duplicated for consumption calculation)
      params.push(user_id, ...subIds, user_id, ...subIds);
      optimizations.push("optimized-join-conditions");
    } else {
      // Match original query structure exactly for non-supervisory roles
      query = `
        SELECT 
          c.id,
          c.name,
          c.logo,
          c.active,
          COUNT(DISTINCT df.id) AS files_count,
          COUNT(DISTINCT CASE 
            WHEN con.tramite_id IS NOT NULL THEN con.tramite_id 
          END) AS total_tramites,
          COALESCE(SUM(con.consumption), 0) AS total_consumption
        FROM 
          comercializadoras c
        LEFT JOIN 
          contracts con ON con.new_company = c.name
        LEFT JOIN 
          tramites t ON t.id = con.tramite_id
        LEFT JOIN 
          documentacion_files df ON df.folder_name LIKE '%' || c.name || '%'
        GROUP BY 
          c.id, c.name, c.logo, c.active
        ORDER BY 
          c.name ASC
      `;

      optimizations.push("exact-original-query-structure");
    }

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
