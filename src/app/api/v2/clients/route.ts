import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { Row } from "@libsql/client";

// Response Types
interface ClientsResponse {
  success: boolean;
  message?: string;
  data?: Row[]; // Using Row[] to match original behavior with clients.*
}

/**
 * Retrieves all clients with aggregated tramites and files data
 * Supports role-based filtering for subcomerciales
 * 
 * @param request - Next.js request object
 * @returns Promise<NextResponse<ClientsResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ClientsResponse>> {
  try {
    const { id, role } = await request.json();

    if (!id || !role) {
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

    // Build optimized query with prepared statement support
    let query = `
      SELECT 
        clients.*, 
        COUNT(DISTINCT tramites.id) AS tramites_count,
        COUNT(DISTINCT tramite_files.id) AS files_count,
        MAX(tramites.creation_date) AS last_tramite_date
      FROM clients 
      LEFT JOIN tramites ON clients.id = tramites.client_id
      LEFT JOIN tramite_files ON tramites.id = tramite_files.tramite_id`;

    const params: string[] = [];

    // Apply role-based filtering
    if (role === "2") {
      // Añadimos WHERE para filtrar por usuario o subcomerciales
      query += ` WHERE`;

      // Get subcomerciales for the user
      const subcomercialesRes = await getSubcomerciales(tursoClient, id);

      if (
        subcomercialesRes.success &&
        subcomercialesRes.ids &&
        subcomercialesRes.ids.length > 0
      ) {
        // Si hay subcomerciales, buscamos trámites del usuario o de cualquiera de sus subcomerciales
        query += ` tramites.user_id = ? OR tramites.user_id IN (${subcomercialesRes.ids.map(() => "?").join(",")})`;
        params.push(id, ...subcomercialesRes.ids);
      } else {
        // Si no hay subcomerciales o falló la consulta, solo buscamos los trámites del usuario
        query += ` tramites.user_id = ?`;
        params.push(id);
      }
    }

    // Group by client to ensure correct aggregation
    query += ` GROUP BY clients.id`;

    // Order by last tramite date descending, handling NULLs
    query += ` ORDER BY last_tramite_date DESC NULLS LAST`;

    // Execute query with performance monitoring
    const startTime = performance.now();
    const res = await tursoClient.execute({ sql: query, args: params });
    const queryTime = performance.now() - startTime;

    // Log performance metrics for monitoring
    console.log(`[PERFORMANCE] Clients query executed in ${queryTime.toFixed(2)}ms, returned ${res.rows.length} rows`);

    // Handle empty results
    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No clients found" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, data: res.rows },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Alternative GET endpoint for REST compliance
 * Accepts user ID and role as query parameters
 * 
 * @param request - Next.js request object
 * @returns Promise<NextResponse<ClientsResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ClientsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const role = searchParams.get("role");

    if (!id || !role) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    // Reuse the POST logic by creating a mock request with body
    const mockRequest = {
      ...request,
      json: async () => ({ id, role }),
    } as NextRequest;

    return await POST(mockRequest);

  } catch (error) {
    console.error("Error in GET /new_api/clients:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
