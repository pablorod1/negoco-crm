import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { applyBulkCommissions } from "@/core/libsql/commissions/companyCommissions";

const bulkSchema = z
  .object({
    user_ids: z.array(z.string().min(1)).min(1),
    comercializadora_ids: z.array(z.string().min(1)).min(1),
    mode: z.enum(["overwrite", "only_missing", "inherit"]),
    commission_type: z.enum(["percent", "fixed"]).optional(),
    commission_value: z.number().min(0).optional(),
  })
  .refine(
    (input) =>
      input.mode === "inherit" ||
      (input.commission_type !== undefined &&
        input.commission_value !== undefined),
    { message: "commission_type y commission_value son obligatorios" },
  );

/**
 * Aplica la misma comisión a varios colaboradores a la vez.
 * Solo dirección, y únicamente sobre comerciales (rol "2") existentes.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (authResult.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const parsed = bulkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters" },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const {
      user_ids: userIds,
      comercializadora_ids: comercializadoraIds,
      mode,
      commission_type: commissionType,
      commission_value: commissionValue,
    } = parsed.data;

    // Solo comerciales: evita crear comisiones a dirección o backoffice si el
    // cliente manda ids de más.
    const usersResponse = await tursoClient.execute({
      sql: `SELECT id FROM user
        WHERE role = '2' AND id IN (${userIds.map(() => "?").join(", ")})`,
      args: userIds,
    });
    const validUserIds = usersResponse.rows.map((row) => String(row.id));

    if (validUserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay comerciales válidos en la selección" },
        { status: 400 },
      );
    }

    await applyBulkCommissions(tursoClient, {
      userIds: validUserIds,
      comercializadoraIds,
      mode,
      commissionType,
      commissionValue,
    });

    return NextResponse.json({
      success: true,
      data: {
        updated_users: validUserIds.length,
        updated_companies: comercializadoraIds.length,
        skipped_users: userIds.length - validUserIds.length,
      },
    });
  } catch (error) {
    console.error("Error applying bulk commissions:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
