import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tramite_id } = await params;
    const { comision, comision_sales_person } = await req.json();

    if (!tramite_id || (!comision && !comision_sales_person)) {
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

    // Build query dynamically with proper parameter handling
    const updateFields = [];
    const queryArgs = [];

    if (comision !== undefined) {
      updateFields.push("comision = ?");
      queryArgs.push(comision);
    }

    if (comision_sales_person !== undefined) {
      updateFields.push("comision_sales_person = ?");
      queryArgs.push(comision_sales_person);
    }

    // Add tramite_id as last argument
    queryArgs.push(tramite_id);

    const sql = `UPDATE tramites SET ${updateFields.join(", ")} WHERE id = ?`;

    const result = await tursoClient.execute({
      sql,
      args: queryArgs,
    });

    if (result.rowsAffected === 0) {
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
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
