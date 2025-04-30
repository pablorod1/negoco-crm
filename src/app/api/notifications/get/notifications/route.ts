import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/libsql/client";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const response = await tursoClient.execute({
      sql: `SELECT * FROM notifications WHERE user_id = ?`,
      args: [id],
    });

    if (response.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    return NextResponse.json({
      success: true,
      data: response.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        message: row.message as string,
        context: row.context as string,
        priority: row.priority as number,
        created_at: row.created_at as string,
        link: row.link as string,
        user_id: row.user_id as string,
        client: row.client as string,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error fetching notifications" },
      { status: 500 }
    );
  }
}
