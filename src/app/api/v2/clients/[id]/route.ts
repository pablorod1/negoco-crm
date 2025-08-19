import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { Row } from "@libsql/client";

// Response Types
interface ClientByIdResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: Row & {
    coordinates: unknown;
  };
}

/**
 * Retrieves a specific client by ID with aggregated tramites and files data
 * Supports role-based filtering for subcomerciales
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<ClientByIdResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ClientByIdResponse>> {
  try {
    // Validate route parameters
    const { id } = await params;
    
    // Parse and validate request body
    const { user_id, user_role } = await request.json();
    
    if (!user_id || !user_role) {
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
        COUNT(DISTINCT tramite_files.id) AS files_count 
      FROM clients
      LEFT JOIN tramites ON clients.id = tramites.client_id
      LEFT JOIN tramite_files ON tramites.id = tramite_files.tramite_id
      WHERE clients.id = ?
      `;
    const queryParams: string[] = [id];

    // Apply role-based filtering
    if (user_role === "2") {
      // Añadimos WHERE para filtrar por usuario o subcomerciales
      query += ` AND (`;

      // Get subcomerciales for the user
      const subcomercialesRes = await getSubcomerciales(tursoClient, user_id);

      if (
        subcomercialesRes.success &&
        subcomercialesRes.ids &&
        subcomercialesRes.ids.length > 0
      ) {
        // Si hay subcomerciales, buscamos trámites del usuario o de cualquiera de sus subcomerciales
        query += ` tramites.user_id = ? OR tramites.user_id IN (${subcomercialesRes.ids.map(() => "?").join(",")}))`;
        queryParams.push(user_id, ...subcomercialesRes.ids);
      } else {
        // Si no hay subcomerciales o falló la consulta, solo buscamos los trámites del usuario
        query += ` tramites.user_id = ?)`;
        queryParams.push(user_id);
      }
    }

    // Group by client to ensure correct aggregation
    query += ` GROUP BY clients.id`;

    // Execute query with performance monitoring
    const startTime = performance.now();
    const res = await tursoClient.execute({ sql: query, args: queryParams });
    const queryTime = performance.now() - startTime;

    // Log performance metrics for monitoring
    console.log(`[PERFORMANCE] Client by ID query executed in ${queryTime.toFixed(2)}ms, returned ${res.rows.length} rows`);

    // Handle client not found or access denied
    if (res.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente no encontrado o no tienes permisos para ver este cliente.",
        },
        { status: 403 }
      );
    }

    // Transform coordinates and return response (maintaining original format)
    return NextResponse.json(
      {
        success: true,
        data: {
          ...res.rows[0],
          coordinates: JSON.parse(res.rows[0].coordinates as string),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Alternative GET endpoint for REST compliance
 * Accepts user_id and user_role as query parameters
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<ClientByIdResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ClientByIdResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");
    const user_role = searchParams.get("user_role");

    if (!user_id || !user_role) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    // Reuse the POST logic by creating a mock request with body
    const mockRequest = {
      ...request,
      json: async () => ({ user_id, user_role }),
    } as NextRequest;

    return await POST(mockRequest, { params });

  } catch (error) {
    console.error("Error in GET /new_api/clients/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
