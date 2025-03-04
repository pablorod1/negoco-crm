import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/libsql/client";

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

    const response = await tursoClient.execute({
      sql: "SELECT id FROM user WHERE super_id = ?;",
      args: [id],
    });

    if (response.rows.length === 0) {
      return NextResponse.json({
        success: false,
      });
    }

    const ids = response.rows.map((row) => row.id as string);

    return NextResponse.json({
      success: true,
      ids,
    });
  } catch (error) {
    console.error("Error fetching subcomerciales:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching subcomerciales",
      },
      { status: 500 }
    );
  }
}
