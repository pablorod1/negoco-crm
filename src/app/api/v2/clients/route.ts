import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { Row } from "@libsql/client";
import { addClient } from "@/tramites/utils/addTramiteHelpers";
import { ClientDB } from "@/tramites/types";

// Response Types
interface ClientsResponse {
  success: boolean;
  message?: string;
  data?: Row[]; // Using Row[] to match original behavior with clients.*
}

interface ClientCreateResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    clientId: string;
  };
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
    const res = await tursoClient.execute({ sql: query, args: params });

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

/**
 * Creates a new client
 *
 * @param request - Next.js request object containing client data
 * @returns Promise<NextResponse<ClientCreateResponse>>
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<ClientCreateResponse>> {
  try {
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { client, signer } = body;

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Missing client data" },
        { status: 400 }
      );
    }

    // Generate client ID if not provided
    const clientId = client.id;

    // Create client object with all required fields
    const clientDB: ClientDB = {
      id: clientId,
      name: client.name,
      last_name: client.last_name || "",
      email: client.email,
      phone: client.phone,
      address: client.address,
      document_number: client.document_number,
      document_type: client.document_type,
      type: client.type,
      IBAN: client.IBAN,
      postal_code: client.postal_code,
      province: client.province,
      city: client.city,
      coordinates: null, // Will be populated by addClient helper
    };

    // Add client to database
    const clientResult = await addClient(clientDB, tursoClient);

    if (!clientResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: clientResult.error || "Error creating client",
        },
        { status: 500 }
      );
    }

    // If client type requires signer and signer data is provided
    if (
      signer &&
      (client.type === "Empresa" || client.type === "Comunidad de Propietarios")
    ) {
      const signerDB = {
        id: crypto.randomUUID(),
        client_id: clientId,
        name: signer.name,
        last_name: signer.last_name,
        email: signer.email,
        phone: signer.phone,
        document_number: signer.document_number,
        document_type: "DNI",
      };

      // Add signer (using the same pattern as in contracts endpoint)
      const signerQuery = `
        INSERT INTO signers (id, client_id, name, last_name, email, phone, document_number, document_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await tursoClient.execute({
        sql: signerQuery,
        args: [
          signerDB.id,
          signerDB.client_id,
          signerDB.name,
          signerDB.last_name,
          signerDB.email,
          signerDB.phone,
          signerDB.document_number,
          signerDB.document_type,
        ],
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Client created successfully",
        data: { clientId },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
