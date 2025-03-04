import { User } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { userData }: { userData: User } = await req.json();

    if (!userData) {
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

    if (!userData.should_reset_password) {
      return;
    }

    const response = await tursoClient.execute({
      sql: `UPDATE user SET should_reset_password = 0 WHERE id = ?`,
      args: [userData.id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
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
