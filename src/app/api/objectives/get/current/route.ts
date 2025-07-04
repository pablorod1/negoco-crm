import { getTursoClient } from "@/core/libsql/client";
import {
  getComparativasRatio,
  getObjectivesTramitesValues,
} from "@/core/libsql/objectives/getObjectivesHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, role } = await req.json();

    if (!id || !role) {
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

    const currentMonth = new Date().toLocaleDateString("es-ES", {
      month: "long",
    });
    const currentYear = new Date().getFullYear();
    const currentPeriod = `${currentMonth} ${currentYear}`;

    const response = await tursoClient.execute({
      sql: `SELECT * FROM objectives WHERE user_id = ? AND period = ?`,
      args: [id, currentPeriod],
    });

    if (response.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const objectives = await Promise.all(
      response.rows.map(async (row) => {
        const objective = {
          id: row.id,
          type: row.type,
          peak: row.peak,
          current: row.current,
          period: row.period,
          created_at: row.created_at,
          completed: row.completed,
          user_id: row.user_id,
        };

        if (objective.type === "tramites") {
          const activeTramitesValues = await getObjectivesTramitesValues(
            tursoClient,
            id,
            role,
            currentPeriod
          );
          objective.current = activeTramitesValues.active;
        }

        if (objective.type === "comisiones") {
          const activeTramitesValues = await getObjectivesTramitesValues(
            tursoClient,
            id,
            role,
            currentPeriod
          );
          objective.current = activeTramitesValues.comision;
        }

        if (objective.type === "ratio") {
          const ratioPercentage = await getComparativasRatio(
            tursoClient,
            id,
            currentPeriod
          );
          objective.current = ratioPercentage;
        }

        return objective;
      })
    );

    return NextResponse.json({
      success: true,
      data: objectives,
    });
  } catch (error) {
    console.error("Error al obtener objetivos:", error);
    return NextResponse.json({
      success: false,
      error: "Internal Server Error",
    });
  }
}
