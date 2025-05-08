import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: tramite_id } = params;
    const { user_id, sales_name } = await req.json();

    if (!tramite_id || !user_id || !sales_name) {
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

    const res = await tursoClient.execute({
      sql: `UPDATE tramites SET user_id = ?, sales_name = ? WHERE id = ?`,
      args: [user_id, sales_name, tramite_id],
    });

    if (res.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No rows affected",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error as string,
      },
      { status: 500 }
    );
  }
}
