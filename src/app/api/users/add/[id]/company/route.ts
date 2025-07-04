import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { company } = await req.json();

    if (!id || !company) {
      return NextResponse.json({
        success: false,
        error: "Missing parameters",
      });
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json({
        success: false,
        error: "Error connecting to the database",
      });
    }

    const res = await tursoClient.execute({
      sql: `UPDATE user SET company = ? WHERE id = ?`,
      args: [company, id],
    });

    if (res.rowsAffected === 0) {
      return NextResponse.json({
        success: false,
        error: "User not found",
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error adding company to user:", error);
    return NextResponse.json({
      success: false,
      error: "Error adding company to user",
    });
  }
}
