import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { changes, user_id } = await req.json();

    if (!id || !changes) {
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

    // Extract individual fields from changes
    const {
      client,
      client_type,
      type,
      comision,
      comision_sales_person,
      status,
    } = changes;
    const updateFields: string[] = [];

    if (client !== undefined) {
      updateFields.push("client = ?");
    }
    if (client_type !== undefined) {
      updateFields.push("client_type = ?");
    }
    if (type !== undefined) {
      updateFields.push("type = ?");
    }
    if (comision !== undefined) {
      updateFields.push("comision = ?");
    }
    if (comision_sales_person !== undefined) {
      updateFields.push("comision_sales_person = ?");
    }

    if (status !== undefined) {
      updateFields.push("status = ?");
    }

    updateFields.push("updated_by = ?");
    updateFields.push("updated_at = CURRENT_TIMESTAMP");

    const query = `
      UPDATE fotovoltaica
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `;

    const args = [
      ...(client ? [client] : []),
      ...(client_type ? [client_type] : []),
      ...(type ? [type] : []),
      ...(comision !== undefined ? [comision] : []),
      ...(comision_sales_person !== undefined ? [comision_sales_person] : []),
      ...(status !== undefined ? [status] : []),
      user_id,
      id,
    ];

    const response = await tursoClient.execute({
      sql: query,
      args: args,
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No rows affected",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Fotovoltaica updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating Fotovoltaica:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
