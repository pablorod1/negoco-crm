import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  getComparativasRatio,
  getObjectivesTramitesValues,
} from "@/core/libsql/objectives/getObjectivesHelpers";

// ===== TYPE DEFINITIONS =====

interface ObjectiveData {
  id: string;
  type: string;
  peak: number;
  current: number;
  period: string;
  created_at: string;
  completed: boolean;
  user_id: string;
}

interface ObjectiveResponse {
  success: boolean;
  data?: ObjectiveData[];
  error?: string;
}

// ===== ZOD VALIDATION SCHEMAS =====

const GetCurrentObjectivesSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  isSubcomercial: z.boolean().optional(),
});

/**
 * Retrieves current period objectives for a user
 * @param request - Next.js request object containing user id and role
 * @returns Promise<NextResponse<ObjectiveResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ObjectiveResponse>> {
  try {
    // Extract query parameters from URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const role = searchParams.get("role");
    const super_id = searchParams.get("super_id");

    // Validate query parameters
    const validation = GetCurrentObjectivesSchema.safeParse({
      id,
      role,
      super_id,
    });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid parameters: " +
            validation.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { id: userId, role: userRole, isSubcomercial } = validation.data;

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Calculate current period
    const currentMonth = new Date().toLocaleDateString("es-ES", {
      month: "long",
    });
    const currentYear = new Date().getFullYear();
    const currentPeriod = `${currentMonth} ${currentYear}`;

    // Execute optimized query with prepared statement for current period only
    const response = await tursoClient.execute({
      sql: `SELECT * FROM objectives WHERE user_id = ? AND period = ? ORDER BY created_at DESC`,
      args: [userId, currentPeriod],
    });

    if (response.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Process objectives with dynamic current values
    const objectives = await Promise.all(
      response.rows.map(async (row) => {
        const objective = {
          id: row.id as string,
          type: row.type as string,
          peak: Number(row.peak),
          current: Number(row.current),
          period: row.period as string,
          created_at: row.created_at as string,
          completed: Boolean(row.completed),
          user_id: row.user_id as string,
        };

        // Update current values based on objective type
        try {
          if (objective.type === "tramites") {
            const activeTramitesValues = await getObjectivesTramitesValues(
              tursoClient,
              userId,
              userRole,
              currentPeriod,
              isSubcomercial ? true : false
            );
            objective.current = Number(activeTramitesValues.active);
          }

          if (objective.type === "comisiones") {
            // Subcomerciales should not see commission objectives
            if (isSubcomercial) {
              objective.current = 0;
            } else {
              const activeTramitesValues = await getObjectivesTramitesValues(
                tursoClient,
                userId,
                userRole,
                currentPeriod,
                isSubcomercial ? true : false
              );
              objective.current = Number(activeTramitesValues.comision);
            }
          }

          if (objective.type === "ratio") {
            const ratioPercentage = await getComparativasRatio(
              tursoClient,
              userId,
              currentPeriod
            );
            objective.current = Number(ratioPercentage);
          }
        } catch (error) {
          console.error(
            `Error calculating current value for objective ${objective.id}:`,
            error
          );
          // Keep the stored current value if calculation fails
        }

        return objective;
      })
    );

    return NextResponse.json({
      success: true,
      data: objectives,
    });
  } catch (error) {
    console.error("Error fetching current objectives:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
