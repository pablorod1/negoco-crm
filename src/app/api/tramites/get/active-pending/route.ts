import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      current_week,
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
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'Pendiente de Firma' THEN 1 ELSE 0 END) AS pending
          FROM tramites WHERE status NOT LIKE 'Borrador'
    `;

    const params: (string | number)[] = [];

    if (current_week) {
      query += ` AND strftime('%Y-%W', creation_date) = strftime('%Y-%W', 'now')`;
    }

    if (role === "2") {
      const subcomercialesRes = await fetch(
        `${req.nextUrl.origin}/api/users/get/subcomerciales?id=${id}`
      );
      const subcomerciales = await subcomercialesRes.json();
      query += ` AND`;
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
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'Pendiente de Firma' THEN 1 ELSE 0 END) AS pending
          FROM tramites WHERE status NOT LIKE 'Borrador'
          AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', 'now', '-1 month')
    `;

    if (role !== "admin" && role !== "1") {
      query += ` AND user_id = ?`;
      params.push(id);
    }

    query += `)
      SELECT 
          cd.total AS total,
          cd.active AS active, 
          cd.pending AS pending,
          COALESCE(pd.active, 0) AS prev_active,
          COALESCE(pd.pending, 0) AS prev_pending
      FROM current_data cd
      LEFT JOIN previous_data pd ON 1=1;
    `;

    const rs = await tursoClient.execute({ sql: query, args: params });

    const current = rs.rows[0] || {
      total: 0,
      active: 0,
      pending: 0,
      prev_active: 0,
      prev_pending: 0,
    };

    const calculatePercentage = (
      currentValue: number,
      previousValue: number
    ) => {
      if (previousValue === 0) return currentValue > 0 ? currentValue * 100 : 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    const activeDifference = calculatePercentage(
      Number(current.active),
      Number(current.prev_active)
    );

    const pendingDifference = calculatePercentage(
      Number(current.pending),
      Number(current.prev_pending)
    );

    return NextResponse.json({
      success: true,
      data: {
        total: current.total as number,
        active: {
          value: current.active as number,
          difference: activeDifference,
        },
        pending: {
          value: current.pending as number,
          difference: pendingDifference,
        },
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
