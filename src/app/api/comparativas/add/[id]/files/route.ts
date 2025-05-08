import { ComparativaFile } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { addComparativaFiles } from "@/lib/libsql/comparativas/addComparativaHelpers";
import {
  updateComparativaComissions,
  updateComparativaStatus,
} from "@/lib/libsql/comparativas/updateComparativaHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await req.formData();

    const organization_id = formData.get("organization_id") as string;
    const documents = formData.get("files") as string;
    const estudio_realizado = formData.get("estudio_realizado") as string;
    const comissionsString = formData.get("comissions") as string;

    const comparativaFiles: ComparativaFile[] = JSON.parse(documents);
    let comissions;
    if (comissionsString) {
      comissions = JSON.parse(comissionsString);
    }

    if (!id || !organization_id) {
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

    if (comparativaFiles.length > 0) {
      const insertFilesResult = await addComparativaFiles(
        comparativaFiles,
        tursoClient
      );

      if (!insertFilesResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: insertFilesResult.error,
          },
          { status: 400 }
        );
      }
    }

    const updateStatusResult = await updateComparativaStatus(
      tursoClient,
      id,
      estudio_realizado === "true" ? "completed" : "pending"
    );

    if (!updateStatusResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateStatusResult.error,
        },
        { status: 400 }
      );
    }

    if (
      comissions &&
      (comissions.comision_fijo ||
        comissions.comision_indexado ||
        comissions.comision_sales_person_fijo ||
        comissions.comision_sales_person_indexado)
    ) {
      const {
        comision_fijo,
        comision_indexado,
        comision_sales_person_fijo,
        comision_sales_person_indexado,
      } = comissions;

      const comissionsResponse = await updateComparativaComissions(
        tursoClient,
        id,
        comision_fijo ? comision_fijo : undefined,
        comision_indexado ? comision_indexado : undefined,
        comision_sales_person_fijo ? comision_sales_person_fijo : undefined,
        comision_sales_person_indexado
          ? comision_sales_person_indexado
          : undefined
      );

      if (!comissionsResponse.success) {
        return NextResponse.json(
          {
            success: false,
            error: comissionsResponse.error,
          },
          { status: 400 }
        );
      }
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
