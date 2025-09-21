import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";

// ===== TYPE DEFINITIONS =====

interface ObjectiveResponse {
  success: boolean;
  error?: string;
}

// ===== ZOD VALIDATION SCHEMAS =====

const UpdateObjectiveSchema = z.object({
  changes: z.object({
    type: z.string().min(1).optional(),
    peak: z.number().positive().optional(),
    period: z.string().min(1).optional(),
  }),
});

const ObjectiveIdSchema = z.object({
  id: z.string().min(1),
});

/**
 * Updates an objective by ID
 * @param request - Next.js request object containing changes to apply
 * @param params - Route parameters containing the objective ID
 * @returns Promise<NextResponse<ObjectiveResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ObjectiveResponse>> {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate route parameters
    const idValidation = ObjectiveIdSchema.safeParse({ id });
    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid objective ID",
        },
        { status: 400 }
      );
    }

    // Validate request body
    const validation = UpdateObjectiveSchema.safeParse(body);
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

    const { changes } = validation.data;

    // Check if there are any changes to apply
    if (!changes.type && !changes.peak && !changes.period) {
      return NextResponse.json(
        {
          success: false,
          error: "No changes provided",
        },
        { status: 400 }
      );
    }

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

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: (string | number)[] = [];

    if (changes.type) {
      updateFields.push(`type = ?`);
      updateValues.push(changes.type);
    }

    if (changes.peak) {
      updateFields.push(`peak = ?`);
      updateValues.push(changes.peak);
    }

    if (changes.period) {
      updateFields.push(`period = ?`);
      updateValues.push(changes.period);
    }

    // Execute update with prepared statement
    const result = await tursoClient.execute({
      sql: `UPDATE objectives SET ${updateFields.join(", ")} WHERE id = ?`,
      args: [...updateValues, id],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Objective not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating objective:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
