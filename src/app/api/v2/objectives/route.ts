import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { NOW_DATE } from "@/dashboard/constants";
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
  data?: ObjectiveData | ObjectiveData[];
  error?: string;
}

// ===== ZOD VALIDATION SCHEMAS =====

const CreateObjectiveSchema = z.object({
  objective: z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    peak: z.number().positive(),
    current: z.number().min(0),
    period: z.string().min(1),
    user_id: z.string().min(1),
    completed: z.boolean(),
  }),
});

const GetObjectivesSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  super_id: z.string().optional().nullable(),
});

// ===== ROUTE HANDLERS =====

/**
 * Creates a new objective
 * @param request - Next.js request object containing objective data
 * @returns Promise<NextResponse<ObjectiveResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ObjectiveResponse>> {
  try {
    const body = await request.json();

    // Validate input using Zod
    const validation = CreateObjectiveSchema.safeParse(body);
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

    const { objective } = validation.data;

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

    // Use prepared statement for better performance and security
    const result = await tursoClient.execute({
      sql: `INSERT INTO objectives (id, type, peak, current, period, created_at, user_id, completed) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        objective.id,
        objective.type,
        objective.peak,
        objective.current,
        objective.period,
        NOW_DATE.toISOString(),
        objective.user_id,
        objective.completed ? 1 : 0, // Convert boolean to integer
      ],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create objective",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: objective.id,
          type: objective.type,
          peak: objective.peak,
          current: objective.current,
          period: objective.period,
          user_id: objective.user_id,
          completed: objective.completed,
          created_at: NOW_DATE.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating objective:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * Retrieves all objectives for a user
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
    const validation = GetObjectivesSchema.safeParse({ id, role, super_id });
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

    const { id: userId, role: userRole, super_id: superId } = validation.data;

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

    // Execute optimized query with prepared statement
    const response = await tursoClient.execute({
      sql: `SELECT * FROM objectives WHERE user_id = ? ORDER BY created_at DESC`,
      args: [userId],
    });

    if (response.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Process objectives with dynamic current values based on each objective's period
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

        // Update current values based on objective type and its specific period
        try {
          if (objective.type === "tramites") {
            const activeTramitesValues = await getObjectivesTramitesValues(
              tursoClient,
              userId,
              userRole,
              objective.period, // Use the objective's period, not current period
              superId
            );
            objective.current = Number(activeTramitesValues.active);
          }

          if (objective.type === "comisiones") {
            // Subcomerciales should not see commission objectives
            if (superId !== null && superId !== undefined) {
              objective.current = 0;
            } else {
              const activeTramitesValues = await getObjectivesTramitesValues(
                tursoClient,
                userId,
                userRole,
                objective.period, // Use the objective's period, not current period
                superId
              );
              objective.current = Number(activeTramitesValues.comision);
            }
          }

          if (objective.type === "ratio") {
            const ratioPercentage = await getComparativasRatio(
              tursoClient,
              userId,
              objective.period // Use the objective's period, not current period
            );
            objective.current = ratioPercentage;
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
    console.error("Error fetching objectives:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
