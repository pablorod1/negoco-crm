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

    const params: (string | number)[] = [];
    let userFilter = "";

    // Preparar la condición de filtrado por usuario basada en el rol
    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      if (
        subcomerciales.success &&
        subcomerciales.ids &&
        subcomerciales.ids.length > 0
      ) {
        userFilter = `AND (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        params.push(id, ...subcomerciales.ids);
      } else {
        userFilter = `AND user_id = ?`;
        params.push(id);
      }
    } else if (role !== "admin" && role !== "1") {
      userFilter = `AND user_id = ?`;
      params.push(id);
    }

    // Consulta optimizada que evita subconsultas repetitivas
    const query = `
      SELECT
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS total, 
        SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS prev_completed
      FROM comparativas
      WHERE 1=1 ${userFilter}
    `;

    const rs = await tursoClient.execute({ sql: query, args: params });

    const data = rs.rows[0] || {
      total: 0,
      completed: 0,
      prev_completed: 0,
    };

    const calculatePercentage = (
      currentValue: number,
      previousValue: number
    ) => {
      if (previousValue === 0) {
        return currentValue !== 0 ? 100 : 0; // Si el valor anterior es 0, retornamos 100% si hay valor actual, o 0 si no hay
      }
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    const completedDifference = calculatePercentage(
      Number(data.completed || 0),
      Number(data.prev_completed || 0)
    );

    return NextResponse.json({
      success: true,
      data: {
        total: Number(data.total || 0),
        value: Number(data.completed || 0),
        prev_value: Number(data.prev_completed || 0),
        difference: completedDifference,
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
