import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      id,
      role,
    }: {
      id: string;
      role: string;
    } = await req.json();

    if (!id || !role) {
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

    const query = `
      WITH current_month AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador' 
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now'))
        ${role === "2" ? "AND t.user_id = ?" : ""}
      ),
      previous_month AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now', '-1 month'))
        ${role === "2" ? "AND t.user_id = ?" : ""}
      ),
      all_time AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        ${role === "2" ? "AND t.user_id = ?" : ""}
      )
      SELECT 
        a.total AS total,
        COALESCE(c.total, 0) AS current_total,
        COALESCE(p.total, 0) AS prev_total
      FROM all_time a, current_month c, previous_month p;
    `;

    const params: string[] = role === "2" ? [id, id, id] : [];

    const rs = await tursoClient.execute({ sql: query, args: params });

    const current = rs.rows[0] || { total: 0, current_total: 0, prev_total: 0 };
    const calculatePercentage = (
      currentValue: number,
      previousValue: number
    ) => {
      if (previousValue === 0) return currentValue > 0 ? currentValue * 100 : 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    const difference = calculatePercentage(
      Number(current.current_total || 0),
      Number(current.prev_total || 0)
    );

    return NextResponse.json({
      success: true,
      data: {
        total: Number(current.total || 0),
        value: Number(current.current_total || 0),
        prev_value: Number(current.prev_total || 0),
        difference: difference,
      },
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching user data",
      },
      { status: 500 }
    );
  }
}
