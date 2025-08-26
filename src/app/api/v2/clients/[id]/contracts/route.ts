import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";

// Response Types
interface ClientContractsResponse {
  success: boolean;
  error?: string;
  data?: {
    contracts: Array<{
      id: string;
      status: string;
      creation_date: string;
      sales_name: string;
    }>;
    total: number;
  };
}

/**
 * GET /api/v2/clients/[id]/contracts
 * Retrieves all contracts (tramites) associated with a specific client
 * Used for showing the user which contracts will be affected when updating client information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ClientContractsResponse>> {
  try {
    const { id: client_id } = await params;

    if (!client_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Client ID is required",
        },
        { status: 400 }
      );
    }

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

    // Query to get all contracts for this client
    const result = await tursoClient.execute({
      sql: `
        SELECT 
          id,
          status,
          creation_date,
          sales_name
        FROM tramites 
        WHERE client_id = ?
        ORDER BY creation_date DESC
      `,
      args: [client_id],
    });

    return NextResponse.json({
      success: true,
      data: {
        contracts: result.rows.map((row) => ({
          id: row.id as string,
          status: row.status as string,
          creation_date: row.creation_date as string,
          sales_name: row.sales_name as string,
        })),
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error("Error fetching client contracts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching client contracts",
      },
      { status: 500 }
    );
  }
}
