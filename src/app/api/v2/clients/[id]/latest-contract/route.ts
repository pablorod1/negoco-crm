import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { Row } from "@libsql/client";

// Response Types
interface LatestContractResponse {
  success: boolean;
  message?: string;
  data?: Row & {
    notes: unknown;
  };
}

/**
 * Retrieves the latest contract (tramite) for a specific client
 * Orders by creation_date DESC and returns the most recent contract
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<LatestContractResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<LatestContractResponse>> {
  try {
    // Validate route parameters (maintain original validation logic)
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    // Execute optimized query with performance monitoring
    const startTime = performance.now();
    const res = await tursoClient.execute({
      sql: `SELECT * FROM tramites WHERE client_id = ? ORDER BY creation_date DESC LIMIT 1;`,
      args: [id],
    });
    const queryTime = performance.now() - startTime;

    // Log performance metrics for monitoring
    console.log(`[PERFORMANCE] Latest contract query executed in ${queryTime.toFixed(2)}ms, returned ${res.rows.length} rows`);

    // Handle no contracts found
    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No tramites found" },
        { status: 200 }
      );
    }

    // Transform response data (maintain original format exactly)
    return NextResponse.json(
      {
        success: true,
        data: {
          ...res.rows[0],
          notes: JSON.parse(res.rows[0].notes as string),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error fetching tramites:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Alternative GET endpoint for REST compliance
 * Maintains the same functionality as POST for backward compatibility
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<LatestContractResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<LatestContractResponse>> {
  try {
    // Reuse POST logic for consistency
    return await POST(request, { params });

  } catch (error) {
    console.error("Error in GET /new_api/clients/[id]/latest-contract:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
