import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";

/**
 * Request/Response Types for Team Performance Analytics
 */
interface TeamMember {
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
    role: string;
    super_id: string;
  };
  active: number;
  baja: number;
}

interface TeamPerformanceResponse {
  success: boolean;
  data?: TeamMember[];
  error?: string;
}

/**
 * Zod Validation Schemas
 */
const TeamPerformanceQuerySchema = z.object({
  id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
  time_range: z.string().optional().default("all_time"),
});

/**
 * Validates time range parameter and builds date filter
 */
const buildTimeRangeFilter = (timeRange: string): string => {
  switch (timeRange) {
    case "current_month":
      return ` AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', 'now')`;
    case "current_week":
      return ` AND strftime('%Y-%W', t.creation_date) = strftime('%Y-%W', 'now')`;
    case "last_week":
      return ` AND strftime('%Y-%W', t.creation_date) = strftime('%Y-%W', 'now', '-7 days')`;
    case "90d":
      return ` AND t.creation_date >= date('now', '-90 days')`;
    case "year":
      return ` AND strftime('%Y', t.creation_date) = strftime('%Y', 'now')`;
    default:
      return "";
  }
};

/**
 * Team performance analytics endpoint
 * Retrieves team member statistics for contracts (active/baja)
 * @param request - Next.js request object containing user credentials and filters
 * @returns Promise<NextResponse<TeamPerformanceResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<TeamPerformanceResponse>> {
  try {
    // Extract query parameters from URL
    const { searchParams } = new URL(request.url);
    const queryParams = {
      id: searchParams.get("id") || "",
      role: searchParams.get("role") || "",
      time_range: searchParams.get("time_range") || "all_time",
    };

    // Validate query parameters
    const validationResult = TeamPerformanceQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters: " + validationResult.error.message,
        },
        { status: 400 }
      );
    }

    const { id, role, time_range } = validationResult.data;

    // Initialize Turso client
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

    // Build base query with role-based filtering
    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.image,
        u.role,
        u.super_id,
        COUNT(CASE WHEN t.status = 'Activo' THEN 1 END) as active,
        COUNT(CASE WHEN t.status = 'Baja' THEN 1 END) as baja
      FROM user u
      LEFT JOIN tramites t ON u.id = t.user_id
    `;

    const params: (string | number)[] = [];

    // Apply role-based user filtering
    if (role === "2") {
      // For commercial roles, get stats for their subcomercials
      query += ` WHERE u.super_id = ?`;
      params.push(id);
    } else {
      // For other roles, get stats for all users except themselves
      query += ` WHERE u.id != ?`;
      params.push(id);
    }

    // Apply time range filtering if specified
    const timeRangeFilter = buildTimeRangeFilter(time_range);
    if (timeRangeFilter) {
      query += timeRangeFilter;
    }

    // Group by user attributes for aggregation
    query += ` GROUP BY u.id, u.name, u.email, u.role, u.super_id, u.image ORDER BY u.name ASC;`;

    // Execute optimized query with prepared statement
    const result = await tursoClient.execute({ 
      sql: query, 
      args: params 
    });

    // Transform database results to response format
    const teamData: TeamMember[] = result.rows.map((row) => ({
      user: {
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        image: row.image as string || "",
        role: row.role as string,
        super_id: row.super_id as string || "",
      },
      active: (row.active as number) || 0,
      baja: (row.baja as number) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: teamData,
    });
  } catch (error) {
    console.error("Error fetching team performance analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching team performance analytics",
      },
      { status: 500 }
    );
  }
}

/**
 * Alternative POST method for backward compatibility
 * Maintains exact compatibility with legacy endpoint
 * @param request - Next.js request object with POST body
 * @returns Promise<NextResponse<TeamPerformanceResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<TeamPerformanceResponse>> {
  try {
    // Parse and validate request body for backward compatibility
    const body = await request.json();
    const validationResult = TeamPerformanceQuerySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Parámetros faltantes",
        },
        { status: 400 }
      );
    }

    const { id, role, time_range } = validationResult.data;

    // Initialize Turso client
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente de base de datos no inicializado",
        },
        { status: 500 }
      );
    }

    // Use same query logic as GET method
    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.image,
        u.role,
        u.super_id,
        COUNT(CASE WHEN t.status = 'Activo' THEN 1 END) as active,
        COUNT(CASE WHEN t.status = 'Baja' THEN 1 END) as baja
      FROM user u
      LEFT JOIN tramites t ON u.id = t.user_id
    `;
    const params: (string | number)[] = [];

    if (role === "2") {
      query += ` WHERE u.super_id = ?`;
      params.push(id);
    } else {
      query += ` WHERE u.id != ?`;
      params.push(id);
    }

    const timeRangeFilter = buildTimeRangeFilter(time_range);
    if (timeRangeFilter) {
      query += timeRangeFilter;
    }

    query += ` GROUP BY u.id, u.name, u.email, u.role, u.super_id, u.image ORDER BY u.name ASC;`;

    const result = await tursoClient.execute({ sql: query, args: params });

    return NextResponse.json({
      success: true,
      data: result.rows.map((row) => ({
        user: {
          id: row.id as string,
          name: row.name as string,
          email: row.email as string,
          image: row.image as string || "",
          role: row.role as string,
          super_id: row.super_id as string || "",
        },
        active: (row.active as number) || 0,
        baja: (row.baja as number) || 0,
      })),
    });
  } catch (error) {
    console.error("Error obteniendo trámites del equipo", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error desconocido obteniendo trámites del equipo",
      },
      { status: 500 }
    );
  }
}
