import { NOW_DATE } from "@/lib/core/const";
import { Objective } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
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
        objective.completed,
      ],
    });

    return NextResponse.json({
      success: true,
      data: objective,
    });
  } catch (error) {
    console.error("Error creating objective:", error);
    return NextResponse.json({
      success: false,
      error: "Error creating objective",
    });
  }
}
