import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      role,
      id,
    }: {
      current_week: boolean;
      role: string;
      id: string;
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

    let query = `
      WITH current_data AS (
          SELECT 
              SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS total,
              SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS active
          FROM tramites 
    `;

    const params: (string | number)[] = [];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      query += ` WHERE`;
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        params.push(id, ...subcomerciales.ids);
      } else {
        query += ` user_id = ?`;
        params.push(id);
      }
    }

    query += `),
      previous_data AS (
          SELECT 
              SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS active
          FROM tramites
          
    `;

    if (role !== "admin" && role !== "1") {
      query += ` WHERE user_id = ?`;
      params.push(id);
    }

    query += `)
      SELECT 
          cd.total AS total,
          cd.active AS active, 
          COALESCE(pd.active, 0) AS prev_active
      FROM current_data cd
      LEFT JOIN previous_data pd ON 1=1;
    `;

    const rs = await tursoClient.execute({ sql: query, args: params });

    const current = rs.rows[0] || {
      total: 0,
      active: 0,
      prev_active: 0,
    };

    const calculatePercentage = (
      currentValue: number,
      previousValue: number
    ) => {
      if (previousValue === 0)
        return currentValue !== 0 ? currentValue * 100 : 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    const activeDifference = calculatePercentage(
      Number(current.active),
      Number(current.prev_active)
    );

    return NextResponse.json({
      success: true,
      data: {
        total: Number(current.total || 0),
        value: Number(current.active || 0),
        prev_value: Number(current.prev_active || 0),
        difference: activeDifference,
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
