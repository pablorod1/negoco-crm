import type { Transaction } from "@libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createComparativaChange } from "@/comparativas/utils/comparativaChangesHelpers";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";

interface ComparisonCommissionsUpdateResponse {
  success: boolean;
  error?: string;
}

type WriteTransaction = Pick<
  Transaction,
  "execute" | "commit" | "rollback" | "close"
>;

const SafeResourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const optionalCommissionNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "string") {
    const numberValue = Number(value.replace(",", "."));
    return Number.isFinite(numberValue) ? numberValue : Number.NaN;
  }
  return value;
}, z.number().finite().optional());

const CommissionsSchema = z
  .strictObject({
    comision_fijo: optionalCommissionNumber,
    comision_indexado: optionalCommissionNumber,
    comision_sales_person_fijo: optionalCommissionNumber,
    comision_sales_person_indexado: optionalCommissionNumber,
  })
  .refine(
    (commissions) =>
      Object.values(commissions).some(
        (commission) => commission !== undefined,
      ),
    { message: "Missing parameters" },
  );

const ComparisonCommissionsUpdateSchema = z.strictObject({
  comissions: CommissionsSchema,
  // Accepted temporarily for old clients, but authorization and auditing
  // derive exclusively from the authenticated session.
  user_id: z.unknown().optional(),
});

const ComparisonPlanSchema = z
  .array(z.enum(["fijo", "indexado"]))
  .min(1)
  .refine((plans) => new Set(plans).size === plans.length);

type CommissionUpdates = z.infer<typeof CommissionsSchema>;
type CommissionField = keyof CommissionUpdates;
type Plan = z.infer<typeof ComparisonPlanSchema>[number];

interface CurrentComparison extends Record<string, unknown> {
  status: unknown;
  plan: unknown;
  comision_fijo: unknown;
  comision_indexado: unknown;
  comision_sales_person_fijo: unknown;
  comision_sales_person_indexado: unknown;
}

interface CommissionFieldDefinition {
  field: CommissionField;
  plan: Plan;
  description: string;
}

const commissionFields: readonly CommissionFieldDefinition[] = [
  {
    field: "comision_fijo",
    plan: "fijo",
    description: "Comisión fija",
  },
  {
    field: "comision_indexado",
    plan: "indexado",
    description: "Comisión indexada",
  },
  {
    field: "comision_sales_person_fijo",
    plan: "fijo",
    description: "Comisión comercial fija",
  },
  {
    field: "comision_sales_person_indexado",
    plan: "indexado",
    description: "Comisión comercial indexada",
  },
];

class TransactionResponseError extends Error {
  constructor(
    readonly status: 404 | 409,
    readonly responseError: string,
  ) {
    super(responseError);
  }
}

function errorResponse(
  status: number,
  error: string,
): NextResponse<ComparisonCommissionsUpdateResponse> {
  return NextResponse.json(
    { success: false, error },
    { status },
  );
}

function parseStoredPlan(value: unknown): Plan[] {
  if (typeof value !== "string") {
    throw new Error("Comparison plan is not serialized");
  }

  const validation = ComparisonPlanSchema.safeParse(JSON.parse(value));
  if (!validation.success) {
    throw new Error("Comparison plan invariant violated");
  }

  return validation.data;
}

function normalizeStoredCommission(
  value: unknown,
  field: CommissionField,
): number {
  if (value === null) return 0;
  if (typeof value === "string" && value.trim() === "") {
    throw new Error(`Invalid stored commission value for ${field}`);
  }
  if (
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "bigint"
  ) {
    throw new Error(`Invalid stored commission value for ${field}`);
  }

  const commission = Number(value);
  if (!Number.isFinite(commission)) {
    throw new Error(`Invalid stored commission value for ${field}`);
  }

  return commission;
}

async function rollbackTransaction(
  transaction: WriteTransaction,
): Promise<boolean> {
  try {
    await transaction.rollback();
    return true;
  } catch (error) {
    console.error("[comparison-commissions] rollback failed", error);
    return false;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ComparisonCommissionsUpdateResponse>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return errorResponse(401, "Unauthorized");
    }

    const authenticatedUser = authResult.user;
    if (
      authenticatedUser.role !== "admin" &&
      authenticatedUser.role !== "1"
    ) {
      return errorResponse(403, "Forbidden");
    }

    const { id } = await params;
    const comparisonIdValidation = SafeResourceIdSchema.safeParse(id);
    if (!comparisonIdValidation.success) {
      return errorResponse(400, "Missing parameters");
    }
    const comparisonId = comparisonIdValidation.data;

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return errorResponse(400, "Missing parameters");
    }

    const bodyValidation =
      ComparisonCommissionsUpdateSchema.safeParse(requestBody);
    if (!bodyValidation.success) {
      return errorResponse(400, "Missing parameters");
    }
    const commissions = bodyValidation.data.comissions;

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      console.error(
        "[comparison-commissions] database client not initialized",
      );
      return errorResponse(500, "Internal server error");
    }

    const transaction: WriteTransaction =
      await tursoClient.transaction("write");

    try {
      try {
        const currentResult = await transaction.execute({
          sql: `SELECT
            status,
            plan,
            comision_fijo,
            comision_indexado,
            comision_sales_person_fijo,
            comision_sales_person_indexado
          FROM comparativas
          WHERE id = ?`,
          args: [comparisonId],
        });

        if (currentResult.rows.length === 0) {
          throw new TransactionResponseError(
            404,
            "Comparativa no encontrada",
          );
        }

        const currentRow = currentResult.rows[0];
        const currentComparison: CurrentComparison = {
          status: currentRow.status,
          plan: currentRow.plan,
          comision_fijo: currentRow.comision_fijo,
          comision_indexado: currentRow.comision_indexado,
          comision_sales_person_fijo:
            currentRow.comision_sales_person_fijo,
          comision_sales_person_indexado:
            currentRow.comision_sales_person_indexado,
        };
        if (currentComparison.status !== "completed") {
          throw new TransactionResponseError(
            409,
            "Comparison status changed",
          );
        }

        const activePlans = new Set(
          parseStoredPlan(currentComparison.plan),
        );
        const submittedFields = commissionFields.filter(
          ({ field }) => commissions[field] !== undefined,
        );

        if (
          submittedFields.some(({ plan }) => !activePlans.has(plan))
        ) {
          throw new TransactionResponseError(
            409,
            "Comparison status changed",
          );
        }

        const auditChanges = submittedFields.flatMap(
          ({ field, description }) => {
            const oldValue = normalizeStoredCommission(
              currentComparison[field],
              field,
            );
            const newValue = commissions[field] as number;
            if (oldValue === newValue) return [];

            return [
              {
                field,
                oldValue,
                newValue,
                description,
              },
            ];
          },
        );
        const updateValues = submittedFields.map(
          ({ field }) => commissions[field] as number,
        );
        const updateResult = await transaction.execute({
          sql: `UPDATE comparativas
            SET ${submittedFields
              .map(({ field }) => `${field} = ?`)
              .join(", ")}
            WHERE id = ?`,
          args: [...updateValues, comparisonId],
        });

        if (updateResult.rowsAffected === 0) {
          throw new TransactionResponseError(
            409,
            "Comparison status changed",
          );
        }
        if (updateResult.rowsAffected !== 1) {
          throw new Error(
            "Comparison commission update affected multiple rows",
          );
        }

        for (const change of auditChanges) {
          const auditRecorded = await createComparativaChange(
            transaction,
            {
              comparativa_id: comparisonId,
              user_id: authenticatedUser.id,
              change_type: "commission_update",
              field_name: change.field,
              old_value: change.oldValue.toString(),
              new_value: change.newValue.toString(),
              description: `${change.description} actualizada de ${change.oldValue}€ a ${change.newValue}€`,
            },
          );
          if (!auditRecorded) {
            throw new Error(
              "Comparison audit could not be recorded",
            );
          }
        }

        await transaction.commit();
        return NextResponse.json({ success: true });
      } catch (error) {
        const rolledBack = await rollbackTransaction(transaction);
        if (
          rolledBack &&
          error instanceof TransactionResponseError
        ) {
          return errorResponse(error.status, error.responseError);
        }

        console.error(
          "[comparison-commissions] transaction failed",
          error,
        );
        return errorResponse(500, "Internal server error");
      }
    } finally {
      await transaction.close();
    }
  } catch (error) {
    console.error("[comparison-commissions] unexpected error", error);
    return errorResponse(500, "Internal server error");
  }
}
