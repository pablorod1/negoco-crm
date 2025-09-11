import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { ComercializadoraVM } from "@/comercializadoras/types";

// Request validation schema
const SupplierByIdRequestSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  user_role: z.string().min(1, "User role is required"),
});

// Response types
interface SupplierByIdResponse {
  success: boolean;
  data?: ComercializadoraVM;
  error?: string;
}

/**
 * Retrieves a specific energy supplier by ID
 *
 * This endpoint provides detailed information about a single supplier including:
 * - Basic supplier information (id, name, logo, active status)
 * - Optional statistics when available
 *
 * @param request - Next.js request object containing user_id and user_role
 * @param params - Route parameters containing the supplier ID
 * @returns Promise<NextResponse<SupplierByIdResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SupplierByIdResponse>> {
  const startTime = Date.now();

  try {
    const { id } = await params;

    // Validate supplier ID
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid supplier ID",
        },
        { status: 400 }
      );
    }

    // Extract query parameters for GET request
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");
    const user_role = searchParams.get("user_role");

    // Validate required parameters
    const validation = SupplierByIdRequestSchema.safeParse({
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

    // Query for specific supplier by ID
    const query = `
      SELECT 
        id,
        name,
        logo,
        active
      FROM comercializadoras 
      WHERE id = ?
      LIMIT 1
    `;

    // Execute query with performance tracking
    const queryStartTime = Date.now();
    const response = await tursoClient.execute({
      sql: query,
      args: [id],
    });
    const queryTime = Date.now() - queryStartTime;

    // Handle not found
    if (response.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Energy supplier not found",
        },
        { status: 404 }
      );
    }

    // Transform result
    const row = response.rows[0];
    const supplier: ComercializadoraVM = {
      id: row.id as string,
      name: row.name as string,
      logo: row.logo as string,
      active: Boolean(row.active),
      // Set defaults for stats fields
      num_tramites: 0,
      num_files: 0,
      total_consumption: 0,
    };

    // Performance metrics for monitoring
    const totalTime = Date.now() - startTime;

    // Log performance metrics in development
    if (process.env.NODE_ENV === "development") {
      console.log("Energy Supplier By ID API Performance:", {
        totalTime: `${totalTime}ms`,
        queryTime: `${queryTime}ms`,
        supplierId: id,
        supplierName: supplier.name,
        userRole: user_role,
      });
    }

    // Return successful response
    return NextResponse.json(
      {
        success: true,
        data: supplier,
      },
      {
        status: 200,
        headers: {
          // Add performance headers for monitoring
          "X-Query-Time": queryTime.toString(),
          // Cache headers for client-side optimization
          "Cache-Control": "public, max-age=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (error) {
    // Enhanced error logging with context
    console.error("Error fetching energy supplier by ID:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      supplierId: (await params)?.id,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SupplierByIdResponse>> {
  try {
    // Parse request body
    const body = await request.json();
    const validation = SupplierByIdRequestSchema.safeParse(body);

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
    return await GET(newRequest, { params });
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
