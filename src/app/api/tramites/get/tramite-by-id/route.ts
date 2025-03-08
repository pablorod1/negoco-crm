import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { Client } from "@libsql/client";
import { NextRequest, NextResponse } from "next/server";

async function executeQuery<T>(
  query: string,
  args: string[],
  tursoClient: Client
): Promise<T[]> {
  const result = await tursoClient.execute({ sql: query, args });
  return result.rows as T[]; // TypeScript ya sabe que rows es del tipo correcto
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    const [
      tramiteResult,
      clientResult,
      contractsResult,
      signerResult,
      filesResult,
    ] = await Promise.all([
      executeQuery<TramiteDB>(
        `SELECT * FROM tramites WHERE id = ?`,
        [id],
        tursoClient
      ),
      executeQuery<ClientDB>(
        `SELECT * FROM clients WHERE id = (SELECT client_id FROM tramites WHERE id = ?)`,
        [id],
        tursoClient
      ),
      executeQuery<ContractDB>(
        `SELECT * FROM contracts WHERE tramite_id = ?`,
        [id],
        tursoClient
      ),
      executeQuery<SignerDB>(
        `SELECT s.* FROM signers s 
             INNER JOIN tramites t ON t.client_id = s.client_id 
             WHERE t.id = ?`,
        [id],
        tursoClient
      ),
      executeQuery<TramiteFile>(
        `SELECT * FROM tramite_files WHERE tramite_id = ?`,
        [id],
        tursoClient
      ),
    ]);

    if (tramiteResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tramite not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tramite: {
          ...tramiteResult[0],
          notes: JSON.parse(tramiteResult[0].notes as string),
        },
        client: clientResult[0],
        contracts: contractsResult,
        signer: signerResult[0],
        files: filesResult,
      },
    });
  } catch (error) {
    console.error("Error fetching tramite by id:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching tramite by id",
      },
      { status: 500 }
    );
  }
}
