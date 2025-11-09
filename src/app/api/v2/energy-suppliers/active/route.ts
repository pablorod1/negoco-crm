import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { ComercializadoraVM } from "@/comercializadoras/types";
import { Row } from "@libsql/client";

// Request validation schema
const ActiveSupplierRequestSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  user_role: z.string().min(1, "User role is required"),
});

// Response types
interface ActiveSupplierResponse {
  success: boolean;
  data?: ComercializadoraVM[];
  error?: string;
}

/**
 * Retrieves only active energy suppliers (comercializadoras) for form dropdowns
 *
 * This endpoint provides a simplified list of active suppliers suitable for:
 * - Form dropdowns and selects
 * - Client-side caching
 * - Fast loading
 *
 * @param request - Next.js request object containing user_id and user_role
 * @returns Promise<NextResponse<ActiveSupplierResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ActiveSupplierResponse>> {
  try {
    // Extract query parameters for GET request
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");
    const user_role = searchParams.get("user_role");

    // Validate required parameters
    const validation = ActiveSupplierRequestSchema.safeParse({
      user_id,
      user_role,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: user_id and user_role",
        },
        { status: 400 }
      );
    }

    // Initialize Turso client
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

    // Simple query for active suppliers only
    const query = `
      SELECT 
        id,
        name,
        logo,
        active
      FROM comercializadoras 
      WHERE active = true
      ORDER BY name ASC
    `;

    // Execute query with performance tracking
    const queryStartTime = Date.now();
    const response = await tursoClient.execute({
      sql: query,
      args: [],
    });
    const queryTime = Date.now() - queryStartTime;

    // Handle empty results
    if (response.rows.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: [],
        },
        { status: 200 }
      );
    }

    // Transform results - simplified for form usage
    const activeSuppliers: ComercializadoraVM[] = response.rows.map(
      (row: Row): ComercializadoraVM => ({
        id: row.id as string,
        name: row.name as string,
        logo: row.logo as string,
        active: Boolean(row.active),
        // Set defaults for stats fields not needed in forms
        num_tramites: 0,
        num_files: 0,
        total_consumption: 0,
      })
    );

    // Return successful response
    return NextResponse.json(
      {
        success: true,
        data: activeSuppliers,
      },
      {
        status: 200,
        headers: {
          // Add performance headers for monitoring
          "X-Query-Time": queryTime.toString(),
          "X-Result-Count": activeSuppliers.length.toString(),
          // Cache headers for client-side optimization
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    // Enhanced error logging with context
    console.error("Error fetching active energy suppliers:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Return consistent error response
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST method for backward compatibility
 * Delegates to GET method logic
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ActiveSupplierResponse>> {
  try {
    // Parse request body
    const body = await request.json();
    const validation = ActiveSupplierRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: user_id and user_role",
        },
        { status: 400 }
      );
    }

    // Create new URL with query parameters for GET method
    const url = new URL(request.url);
    url.searchParams.set("user_id", validation.data.user_id);
    url.searchParams.set("user_role", validation.data.user_role);

    // Create new request with modified URL
    const newRequest = new NextRequest(url, {
      method: "GET",
      headers: request.headers,
    });

    // Delegate to GET method
    return await GET(newRequest);
  } catch (error) {
    console.error("Error in POST method:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
