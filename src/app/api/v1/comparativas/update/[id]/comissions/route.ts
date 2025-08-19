import { getTursoClient } from "@/core/libsql/client";
import { updateComparativaComissions } from "@/comparativas/utils/updateComparativaHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { comissions } = await req.json();

    if (!id || !comissions) {
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

    const {
      comision_fijo,
      comision_indexado,
      comision_sales_person_fijo,
      comision_sales_person_indexado,
    } = comissions;

    const response = await updateComparativaComissions(
      tursoClient,
      id,
      comision_fijo ? comision_fijo : undefined,
      comision_indexado ? comision_indexado : undefined,
      comision_sales_person_fijo ? comision_sales_person_fijo : undefined,
      comision_sales_person_indexado
        ? comision_sales_person_indexado
        : undefined
    );

    if (!response.success) {
      return NextResponse.json(
        {
          success: false,
          error: response.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al actualizar comisiones:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar comisiones",
      },
      { status: 500 }
    );
  }
}
