import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import type { Client, Row } from "@libsql/client";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import { updateClient } from "@/tramites/utils/updateTramiteHelpers";

const DocumentTypeSchema = z.enum(["DNI", "NIE", "CIF", "Otro", ""]);

const ClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z.string().min(1, "Name is required"),
  last_name: z.string().optional().default(""),
  email: z.string().email("Valid email is required"),
  type: z.string().min(1, "Client type is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  postal_code: z.string().optional().default(""),
  province: z.string().optional().default(""),
  city: z.string().optional().default(""),
  document_type: DocumentTypeSchema,
  document_number: z.string().min(1, "Document number is required"),
  IBAN: z.string().min(1, "IBAN is required"),
});

// Response Types
interface ClientByIdResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: Record<string, unknown> & {
    coordinates: unknown;
    signer?: Row | null;
  };
}

const signerRequiredClientTypes = ["Empresa", "Comunidad de Propietarios"];

const UpdateClientRequestSchema = z.object({
  client: ClientSchema,
  user_id: z.string().min(1, "User ID is required"), // Add user_id for tracking
});

interface ClientResponse {
  success: boolean;
  error?: string;
}

async function canUpdateClient(
  tursoClient: Client,
  clientId: string,
  userId: string,
  userRole: string,
) {
  if (userRole !== "2") return true;

  const subcomerciales = await getSubcomerciales(tursoClient, userId);
  const allowedUserIds = [userId];
  if (subcomerciales.success && subcomerciales.ids.length > 0) {
    allowedUserIds.push(...subcomerciales.ids);
  }

  const result = await tursoClient.execute({
    sql: `SELECT 1 FROM tramites WHERE client_id = ? AND user_id IN (${allowedUserIds.map(() => "?").join(", ")}) LIMIT 1`,
    args: [clientId, ...allowedUserIds],
  });

  return result.rows.length > 0;
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
    const res = await tursoClient.execute({ sql: query, args: queryParams });

    // Handle client not found or access denied
    if (res.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o no tienes permisos para ver este cliente.",
        },
        { status: 403 }
      );
    }

    const client = res.rows[0];
    let signer: Row | null | undefined;

    if (signerRequiredClientTypes.includes(client.type as string)) {
      const signerRes = await tursoClient.execute({
        sql: "SELECT * FROM signers WHERE client_id = ? LIMIT 1",
        args: [id],
      });
      signer = signerRes.rows[0] ?? null;
    }

    // Transform coordinates and return response (maintaining original format)
    return NextResponse.json(
      {
        success: true,
        data: {
          ...client,
          coordinates: JSON.parse(client.coordinates as string),
          ...(signer !== undefined ? { signer } : {}),
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

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<ClientResponse>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = UpdateClientRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { client } = validationResult.data;

    const tursoClient = getTursoClient(request) as Client | null;

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    const hasAccess = await canUpdateClient(
      tursoClient,
      client.id,
      authResult.user.id,
      authResult.user.role,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const updateClientRes = await updateClient(client, client.id, tursoClient);

    if (!updateClientRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateClientRes.error || "Error updating client",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error updating client information",
      },
      { status: 500 }
    );
  }
}
