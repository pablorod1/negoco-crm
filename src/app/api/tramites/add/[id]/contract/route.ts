import { ContractDB } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { addContracts } from "@/lib/libsql/tramites/addTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tramite_id } = await params;
    const formData = await req.formData();

    const contractsString = formData.get("contracts") as string;
    const contracts: ContractDB[] = JSON.parse(contractsString);

    if (!contracts || !tramite_id) {
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

    if (contracts && contracts.length > 0) {
      const contractsResult = await addContracts(contracts, tursoClient);
      if (!contractsResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: contractsResult.error,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al agregar el contrato",
      },
      { status: 500 }
    );
  }
}
