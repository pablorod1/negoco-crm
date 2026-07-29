import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import type { Client, Transaction } from "@libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { validateUserSession } from "@/core/auth/session-utils";
import { getEffectivePermission } from "@/core/access-control/server";
import {
  recordStatusChange,
  recordCommissionChange,
  recordConvertedToContract,
} from "@/comparativas/utils/comparativaChangesHelpers";

/**
 * Request validation schema for comparison status updates
 */
const optionalCommissionNumber = z.preprocess((val) => {
  // Treat empty values as undefined (field not provided)
  if (val === undefined || val === null || val === "") return undefined;
  // Normalize strings, allowing comma decimal separators
  if (typeof val === "string") {
    const normalized = val.replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : NaN; // NaN will fail .finite()
  }
  return val;
}, z.number().finite().optional());

const SafeResourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const ComparisonStatusUpdateSchema = z.object({
  status: z.enum([
    "pending",
    "awaiting_review",
    "completed",
    "processed",
    "rejected",
    "rechazado_cliente",
  ]),
  tramite_id: SafeResourceIdSchema.optional(),
  company_id: SafeResourceIdSchema.optional(), // For completed comparisons
  comissions: z
    .object({
      comision_fijo: optionalCommissionNumber,
      comision_indexado: optionalCommissionNumber,
      comision_sales_person_fijo: optionalCommissionNumber,
      comision_sales_person_indexado: optionalCommissionNumber,
    })
    .optional(),
});

const ComparisonPlanSchema = z
  .array(z.enum(["fijo", "indexado"]))
  .min(1);

/**
 * Response interface for comparison status update
 */
interface ComparisonStatusUpdateResponse {
  success: boolean;
  error?: string;
}

type QueryClient = Pick<Client, "execute">;
type WriteTransaction = Pick<
  Transaction,
  "execute" | "commit" | "rollback"
>;

interface AccessibleComparison {
  status: string;
  tramiteId: string | null;
  companyId: string | null;
  plan: string;
  commissions: {
    comision_fijo: number | null;
    comision_indexado: number | null;
    comision_sales_person_fijo: number | null;
    comision_sales_person_indexado: number | null;
  };
}

type StudyPermission =
  | "comparisons.study.complete"
  | "comparisons.study.review";

type StatusTransitionValidation =
  | {
      allowed: true;
      requiredPermission: StudyPermission | null;
      tramiteId: string | undefined;
      tramiteIdToValidate: string | undefined;
    }
  | { allowed: false };

function validateStatusTransition(
  currentComparison: AccessibleComparison,
  nextStatus: string,
  userRole: string,
  fields: {
    tramiteId: string | undefined;
    companyId: string | undefined;
    commissions:
      | {
          comision_fijo?: number;
          comision_indexado?: number;
          comision_sales_person_fijo?: number;
          comision_sales_person_indexado?: number;
        }
      | undefined;
  },
): StatusTransitionValidation {
  const currentStatus = currentComparison.status;
  if (currentStatus === nextStatus) return { allowed: false };

  if (
    nextStatus !== "completed" &&
    (fields.companyId !== undefined || fields.commissions !== undefined)
  ) {
    return { allowed: false };
  }

  if (nextStatus !== "processed" && fields.tramiteId !== undefined) {
    return { allowed: false };
  }

  let requiredPermission: StudyPermission | null = null;
  switch (currentStatus) {
    case "pending":
      if (nextStatus !== "completed" && nextStatus !== "rejected") {
        return { allowed: false };
      }
      requiredPermission = "comparisons.study.complete";
      break;
    case "awaiting_review":
      if (nextStatus !== "completed") return { allowed: false };
      requiredPermission = "comparisons.study.review";
      break;
    case "completed":
      if (
        nextStatus !== "processed" &&
        nextStatus !== "rechazado_cliente"
      ) {
        return { allowed: false };
      }
      break;
    case "rejected":
    case "rechazado_cliente":
      if (
        (userRole !== "admin" && userRole !== "1") ||
        ![
          "pending",
          "completed",
          "rejected",
          "rechazado_cliente",
        ].includes(nextStatus)
      ) {
        return { allowed: false };
      }
      if (nextStatus === "completed") {
        requiredPermission = "comparisons.study.complete";
      }
      break;
    case "processed":
    default:
      return { allowed: false };
  }

  if (nextStatus !== "processed") {
    return {
      allowed: true,
      requiredPermission,
      tramiteId: undefined,
      tramiteIdToValidate: undefined,
    };
  }

  const submittedTramiteId = fields.tramiteId;
  if (currentComparison.tramiteId !== null) {
    if (
      submittedTramiteId !== undefined &&
      submittedTramiteId !== currentComparison.tramiteId
    ) {
      return { allowed: false };
    }

    return {
      allowed: true,
      requiredPermission,
      tramiteId: undefined,
      tramiteIdToValidate: undefined,
    };
  }

  if (submittedTramiteId === undefined) return { allowed: false };

  return {
    allowed: true,
    requiredPermission,
    tramiteId: submittedTramiteId,
    tramiteIdToValidate: submittedTramiteId,
  };
}

async function getAccessibleComparison(
  client: QueryClient,
  comparativaId: string,
  userId: string,
  userRole: string,
): Promise<AccessibleComparison | null> {
  const args: string[] = [comparativaId];
  let sql = `SELECT
    status,
    tramite_id,
    company_id,
    plan,
    comision_fijo,
    comision_indexado,
    comision_sales_person_fijo,
    comision_sales_person_indexado
    FROM comparativas
    WHERE id = ?`;

  if (userRole === "2") {
    const subcomerciales = await getSubcomerciales(client, userId);
    const allowedUserIds = [userId];

    if (subcomerciales.success && subcomerciales.ids.length > 0) {
      allowedUserIds.push(...subcomerciales.ids);
    }

    sql += ` AND user_id IN (${allowedUserIds.map(() => "?").join(", ")})`;
    args.push(...allowedUserIds);
  } else if (userRole !== "admin" && userRole !== "1") {
    return null;
  }

  const result = await client.execute({ sql, args });
  const row = result.rows[0];
  if (!row) return null;

  return {
    status: String(row.status),
    plan: String(row.plan),
    tramiteId:
      row.tramite_id === null || row.tramite_id === undefined
        ? null
        : String(row.tramite_id),
    companyId:
      row.company_id === null || row.company_id === undefined
        ? null
        : String(row.company_id),
    commissions: {
      comision_fijo:
        row.comision_fijo === null || row.comision_fijo === undefined
          ? null
          : Number(row.comision_fijo),
      comision_indexado:
        row.comision_indexado === null || row.comision_indexado === undefined
          ? null
          : Number(row.comision_indexado),
      comision_sales_person_fijo:
        row.comision_sales_person_fijo === null ||
        row.comision_sales_person_fijo === undefined
          ? null
          : Number(row.comision_sales_person_fijo),
      comision_sales_person_indexado:
        row.comision_sales_person_indexado === null ||
        row.comision_sales_person_indexado === undefined
          ? null
          : Number(row.comision_sales_person_indexado),
    },
  };
}

async function hasValidCompletionState(
  client: QueryClient,
  currentComparison: AccessibleComparison,
  companyId: string | undefined,
  commissions:
    | {
        comision_fijo?: number;
        comision_indexado?: number;
        comision_sales_person_fijo?: number;
        comision_sales_person_indexado?: number;
      }
    | undefined,
): Promise<boolean> {
  let planData: unknown;
  try {
    planData = JSON.parse(currentComparison.plan);
  } catch {
    return false;
  }
  const plan = ComparisonPlanSchema.safeParse(planData);
  if (!plan.success) return false;

  const finalCommissions = { ...currentComparison.commissions };
  if (commissions) {
    for (const [field, value] of Object.entries(commissions) as Array<
      [
        keyof AccessibleComparison["commissions"],
        number | undefined,
      ]
    >) {
      if (value !== undefined) finalCommissions[field] = value;
    }
  }
  const requiredCommissionFields: Array<
    keyof AccessibleComparison["commissions"]
  > = [];
  if (plan.data.includes("fijo")) {
    requiredCommissionFields.push(
      "comision_fijo",
      "comision_sales_person_fijo",
    );
  }
  if (plan.data.includes("indexado")) {
    requiredCommissionFields.push(
      "comision_indexado",
      "comision_sales_person_indexado",
    );
  }
  if (
    requiredCommissionFields.some(
      (field) =>
        finalCommissions[field] === null ||
        !Number.isFinite(finalCommissions[field]),
    )
  ) {
    return false;
  }

  const finalCompanyId = companyId ?? currentComparison.companyId;
  if (finalCompanyId === null) return false;

  const supplier = await client.execute({
    sql: `SELECT id
      FROM comercializadoras
      WHERE id = ? AND active = true
      LIMIT 1`,
    args: [finalCompanyId],
  });
  return supplier.rows.length > 0;
}

async function hasAccessibleTramite(
  client: QueryClient,
  tramiteId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  const args = [tramiteId];
  let sql = "SELECT id FROM tramites WHERE id = ?";

  if (userRole === "2") {
    const subcomerciales = await getSubcomerciales(client, userId);
    const allowedUserIds = [userId];

    if (subcomerciales.success && subcomerciales.ids.length > 0) {
      allowedUserIds.push(...subcomerciales.ids);
    }

    sql += ` AND user_id IN (${allowedUserIds.map(() => "?").join(", ")})`;
    args.push(...allowedUserIds);
  } else if (userRole !== "admin" && userRole !== "1") {
    return false;
  }

  const result = await client.execute({ sql, args });
  return result.rows.length > 0;
}

class ComparisonConflictError extends Error {
  constructor() {
    super("Comparison status changed concurrently");
    this.name = "ComparisonConflictError";
  }
}

async function executeStatusUpdate(
  client: QueryClient,
  comparativaId: string,
  currentComparison: AccessibleComparison,
  status: string,
  tramiteId?: string,
  userId?: string,
  companyId?: string,
): Promise<void> {
  let query = "UPDATE comparativas SET status = ?";
  const args: (string | null)[] = [status];

  if (tramiteId !== undefined) {
    query += ", tramite_id = ?";
    args.push(tramiteId);
  }

  if (companyId !== undefined) {
    query += ", company_id = ?";
    args.push(companyId);
  }

  query += " WHERE id = ? AND status = ?";
  args.push(comparativaId, currentComparison.status);
  if (status === "processed") {
    if (currentComparison.tramiteId === null) {
      query += " AND tramite_id IS NULL";
    } else {
      query += " AND tramite_id = ?";
      args.push(currentComparison.tramiteId);
    }
  }

  const response = await client.execute({ sql: query, args });
  if (response.rowsAffected === 0) {
    throw new ComparisonConflictError();
  }

  if (currentComparison.status !== status) {
    const auditRecorded = await recordStatusChange(
      client,
      comparativaId,
      userId || null,
      currentComparison.status,
      status,
    );
    if (!auditRecorded) {
      throw new Error("Status audit could not be recorded");
    }
  }

  if (tramiteId && !currentComparison.tramiteId) {
    const auditRecorded = await recordConvertedToContract(
      client,
      comparativaId,
      userId || null,
      tramiteId,
    );
    if (!auditRecorded) {
      throw new Error("Conversion audit could not be recorded");
    }
  }
}

async function executeCommissionUpdate(
  client: QueryClient,
  comparativaId: string,
  currentCommissions: AccessibleComparison["commissions"],
  commissions: {
    comision_fijo?: number;
    comision_indexado?: number;
    comision_sales_person_fijo?: number;
    comision_sales_person_indexado?: number;
  },
  userId?: string,
): Promise<void> {
  const updates: string[] = [];
  const params: (number | string)[] = [];
  const changes: Array<{
    field: keyof AccessibleComparison["commissions"];
    oldValue: number | null;
    newValue: number;
  }> = [];

  for (const [field, value] of Object.entries(commissions) as Array<
    [keyof AccessibleComparison["commissions"], number | undefined]
  >) {
    if (value === undefined) continue;

    updates.push(`${field} = ?`);
    params.push(value);
    if (currentCommissions[field] !== value) {
      changes.push({
        field,
        oldValue: currentCommissions[field],
        newValue: value,
      });
    }
  }

  if (updates.length === 0) return;

  params.push(comparativaId);
  const response = await client.execute({
    sql: `UPDATE comparativas SET ${updates.join(", ")} WHERE id = ?`,
    args: params,
  });
  if (response.rowsAffected === 0) {
    throw new Error("Comparison commissions could not be updated");
  }

  for (const change of changes) {
    const auditRecorded = await recordCommissionChange(
      client,
      comparativaId,
      userId || null,
      change.field,
      change.oldValue,
      change.newValue,
    );
    if (!auditRecorded) {
      throw new Error("Commission audit could not be recorded");
    }
  }
}

/**
 * Updates comparison status with optional tramite_id and commission adjustments
 *
 * This endpoint provides atomic updates for comparison status changes,
 * maintaining full backward compatibility with the original endpoint
 * while adding performance optimizations and enhanced type safety.
 *
 * @param req - Next.js request object containing update data
 * @param params - URL parameters containing comparison ID
 * @returns Promise<NextResponse<ComparisonStatusUpdateResponse>>
 *
 * @example
 * PATCH /new_api/comparisons/[id]/status
 * Body: {
 *   "status": "completed",
 *   "tramite_id": "tramite123",
 *   "comissions": {
 *     "comision_fijo": 75.0,
 *     "comision_sales_person_fijo": 35.0
 *   }
 * }
 *
 * Response: {
 *   "success": true
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ComparisonStatusUpdateResponse>> {
  try {
    const { id } = await params;

    const authResult = await validateUserSession(req);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const authenticatedUser = authResult.user;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON",
        },
        { status: 400 },
      );
    }

    const validation = ComparisonStatusUpdateSchema.safeParse(body);
    const comparisonIdValidation = SafeResourceIdSchema.safeParse(id);

    if (!validation.success || !comparisonIdValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 },
      );
    }

    const { status, tramite_id, comissions, company_id } = validation.data;
    const comparisonId = comparisonIdValidation.data;

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      console.error("[comparison-status] database client not initialized");
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
        },
        { status: 500 },
      );
    }

    const transaction: WriteTransaction =
      await tursoClient.transaction("write");

    try {
      const accessibleComparison = await getAccessibleComparison(
        transaction,
        comparisonId,
        authenticatedUser.id,
        authenticatedUser.role,
      );

      if (!accessibleComparison) {
        await transaction.rollback();
        return NextResponse.json(
          {
            success: false,
            error: "Comparativa no encontrada",
          },
          { status: 404 },
        );
      }

      const transition = validateStatusTransition(
        accessibleComparison,
        status,
        authenticatedUser.role,
        {
          tramiteId: tramite_id,
          companyId: company_id,
          commissions: comissions,
        },
      );
      if (!transition.allowed) {
        await transaction.rollback();
        return NextResponse.json(
          {
            success: false,
            error: "Comparison status changed",
          },
          { status: 409 },
        );
      }

      if (transition.requiredPermission) {
        const hasRequiredPermission = await getEffectivePermission(
          transaction,
          authenticatedUser,
          transition.requiredPermission,
        );
        if (!hasRequiredPermission) {
          await transaction.rollback();
          return NextResponse.json(
            {
              success: false,
              error: "Forbidden",
            },
            { status: 403 },
          );
        }
      }

      if (
        transition.tramiteIdToValidate &&
        !(await hasAccessibleTramite(
          transaction,
          transition.tramiteIdToValidate,
          authenticatedUser.id,
          authenticatedUser.role,
        ))
      ) {
        await transaction.rollback();
        return NextResponse.json(
          {
            success: false,
            error: "Comparison status changed",
          },
          { status: 409 },
        );
      }

      if (
        status === "completed" &&
        !(await hasValidCompletionState(
          transaction,
          accessibleComparison,
          company_id,
          comissions,
        ))
      ) {
        await transaction.rollback();
        return NextResponse.json(
          {
            success: false,
            error: "Comparison status changed",
          },
          { status: 409 },
        );
      }

      await executeStatusUpdate(
        transaction,
        comparisonId,
        accessibleComparison,
        status,
        transition.tramiteId,
        authenticatedUser.id,
        company_id,
      );

      if (comissions) {
        await executeCommissionUpdate(
          transaction,
          comparisonId,
          accessibleComparison.commissions,
          comissions,
          authenticatedUser.id,
        );
      }

      await transaction.commit();
      return NextResponse.json({ success: true });
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        console.error("[comparison-status] transaction rollback failed");
        return NextResponse.json(
          {
            success: false,
            error: "Internal server error",
          },
          { status: 500 },
        );
      }

      if (error instanceof ComparisonConflictError) {
        return NextResponse.json(
          {
            success: false,
            error: "Comparison status changed",
          },
          { status: 409 },
        );
      }

      console.error("[comparison-status] transaction failed");
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
        },
        { status: 500 },
      );
    }
  } catch {
    console.error("[comparison-status] unexpected error");

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
