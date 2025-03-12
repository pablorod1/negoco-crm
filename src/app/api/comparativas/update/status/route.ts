import { getTursoClient } from "@/lib/libsql/client";
import {
  updateComparativaComissions,
  updateComparativaStatus,
} from "@/lib/libsql/comparativas/updateComparativaHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, comissions, tramite_id } = await req.json();

    if (!id || !status) {
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

    const { success, error } = await updateComparativaStatus(
      tursoClient,
      id,
      status,
      tramite_id ? tramite_id : undefined
    );

    if (comissions) {
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
    }

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating comparativa:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
