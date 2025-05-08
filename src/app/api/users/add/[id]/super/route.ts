import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: user_id } = params;
    const { super_id } = await req.json();

    if (!user_id || !super_id) {
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

    const response = await tursoClient.execute({
      sql: `UPDATE user SET super_id = ? WHERE id = ?`,
      args: [super_id, user_id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No se ha encontrado el usuario",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error adding super user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error adding super user",
      },
      { status: 500 }
    );
  }
}
