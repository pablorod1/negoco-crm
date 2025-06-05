import { FotovoltaicaFile } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { addFotovoltaicaFiles } from "@/lib/libsql/fotovoltaica/addFotovoltaicaHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    const documents = formData.get("files") as string;
    const comissionsString = formData.get("comissions") as string;
    const status = formData.get("status") as string;

    const fotovoltaicaFiles: FotovoltaicaFile[] = JSON.parse(documents);

    let comissions;
    if (comissionsString) {
      comissions = JSON.parse(comissionsString);
    }

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

    if (fotovoltaicaFiles.length > 0) {
      const insertFilesResult = await addFotovoltaicaFiles(
        fotovoltaicaFiles,
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

    if (status && comissions) {
      const updateStatusResult = await tursoClient.execute({
        sql: `
          UPDATE fotovoltaica
          SET status = ?, comision = ?, comision_sales_person = ?
          WHERE id = ?
        `,
        args: [
          status,
          comissions.comision,
          comissions.comision_sales_person,
          id,
        ],
      });

      if (updateStatusResult.rowsAffected === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No rows affected",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Archivos de la fotovoltaica agregados correctamente.",
    });
  } catch (error) {
    console.error("Error adding fotovoltaica files:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al agregar los archivos de la fotovoltaica.",
      },
      { status: 500 }
    );
  }
}
