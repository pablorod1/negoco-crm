import { NOW_DATE } from "@/dashboard/constants";
import { Objective } from "@/dashboard/types";
import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { objective }: { objective: Objective } = await req.json();

    if (!objective) {
      return NextResponse.json({
        success: false,
        error: "Missing Parameters",
      });
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

    await tursoClient.execute({
      sql: `INSERT INTO objectives (id, type, peak, current, period, created_at, user_id, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        objective.id,
        objective.type,
        objective.peak,
        objective.current,
        objective.period,
        NOW_DATE.toISOString(),
        objective.user_id,
        objective.completed ? 1 : 0,
      ],
    });

    return NextResponse.json({
      success: true,
      data: objective,
    });
  } catch (error) {
    console.error("Error creating objective:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error creating objective",
      },
      { status: 500 }
    );
  }
}
