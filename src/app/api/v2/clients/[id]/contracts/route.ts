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
      files_count: number;
    }>;
    total: number;
    files_total: number;
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

    const result = await tursoClient.execute({
      sql: `
        SELECT 
          tramites.id,
          tramites.status,
          tramites.creation_date,
          tramites.sales_name,
          COUNT(DISTINCT tramite_files.id) AS files_count
        FROM tramites 
        LEFT JOIN tramite_files ON tramite_files.tramite_id = tramites.id
        WHERE tramites.client_id = ?
        GROUP BY tramites.id
        ORDER BY tramites.creation_date DESC
      `,
      args: [client_id],
    });

    const contracts = result.rows.map((row) => ({
      id: row.id as string,
      status: row.status as string,
      creation_date: row.creation_date as string,
      sales_name: row.sales_name as string,
      files_count: Number(row.files_count || 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        contracts,
        total: contracts.length,
        files_total: contracts.reduce(
          (total, contract) => total + contract.files_count,
          0
        ),
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
