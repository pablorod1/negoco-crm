import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    const res = await tursoClient.execute({
      sql: `SELECT * FROM tramites WHERE client_id = ? ORDER BY creation_date DESC LIMIT 1;`,
      args: [id],
    });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No tramites found" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...res.rows[0],
          notes: JSON.parse(res.rows[0].notes as string),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching tramites:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
