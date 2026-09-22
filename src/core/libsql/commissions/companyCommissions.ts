import type { Client, InStatement } from "@libsql/client";
import { executeReadWithRetry } from "@/core/libsql/executeWithRetry";
import type {
  CommissionType,
  CommissionSegment,
  DefaultCompanyCommission,
  UserCompanyCommission,
} from "@/core/types";
import { enqueueCommissionSyncStatements } from "@/integrations/abarca/commissions/sync-state";

/**
 * Las comisiones se resuelven en dos niveles:
 *   1. override del colaborador (user_company_commissions)
 *   2. valor por defecto de la asesoría (default_company_commissions)
 * Si el colaborador no tiene fila propia para una comercializadora, hereda el
 * valor por defecto. Así cambiar el porcentaje "para todos" es una sola edición.
 */

export type CommissionApplyMode = "overwrite" | "only_missing" | "inherit";

function toCommissionType(value: unknown): CommissionType {
  return String(value) === "fixed" ? "fixed" : "percent";
}

function toCommissionSegment(value: unknown): CommissionSegment {
  if (value === "luz_pymes" || value === "gas") return value;
  return "luz_20td";
}

const commissionKey = (supplierId: string, segment: CommissionSegment) =>
  `${supplierId}:${segment}`;

export async function getDefaultCommissions(
  tursoClient: Client,
): Promise<DefaultCompanyCommission[]> {
  const response = await executeReadWithRetry(tursoClient, {
    sql: `SELECT
      dcc.id,
      dcc.comercializadora_id,
      dcc.segment,
      c.name AS comercializadora_name,
      dcc.commission_type,
      dcc.commission_value,
      dcc.created_at,
      dcc.updated_at
    FROM default_company_commissions dcc
    LEFT JOIN comercializadoras c ON c.id = dcc.comercializadora_id
    ORDER BY c.name ASC`,
    args: [],
  });

  return response.rows.map((row) => ({
    id: String(row.id),
    comercializadora_id: String(row.comercializadora_id),
    comercializadora_name: row.comercializadora_name
      ? String(row.comercializadora_name)
      : null,
    segment: toCommissionSegment(row.segment),
    commission_type: toCommissionType(row.commission_type),
    commission_value: Number(row.commission_value) || 0,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function getUserCommissionOverrides(
  tursoClient: Client,
  userId: string,
): Promise<UserCompanyCommission[]> {
  const response = await executeReadWithRetry(tursoClient, {
    sql: `SELECT
      ucc.id,
      ucc.user_id,
      ucc.comercializadora_id,
      ucc.segment,
      c.name AS comercializadora_name,
      ucc.commission_type,
      ucc.commission_value,
      ucc.created_at,
      ucc.updated_at
    FROM user_company_commissions ucc
    LEFT JOIN comercializadoras c ON c.id = ucc.comercializadora_id
    WHERE ucc.user_id = ?
    ORDER BY c.name ASC`,
    args: [userId],
  });

  return mapOverrideRows(response.rows);
}

function mapOverrideRows(rows: { [key: string]: unknown }[]): UserCompanyCommission[] {
  return rows.map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    comercializadora_id: String(row.comercializadora_id),
    comercializadora_name: row.comercializadora_name
      ? String(row.comercializadora_name)
      : null,
    segment: toCommissionSegment(row.segment),
    commission_type: toCommissionType(row.commission_type),
    commission_value: Number(row.commission_value) || 0,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    source: "user" as const,
  }));
}

/**
 * Todos los overrides de la asesoría en una sola consulta. Lo usa la matriz de
 * comisiones del panel de administración para pintar los overrides de todos
 * los colaboradores sin hacer una petición por colaborador.
 */
export async function getAllCommissionOverrides(
  tursoClient: Client,
): Promise<UserCompanyCommission[]> {
  const response = await executeReadWithRetry(tursoClient, {
    sql: `SELECT
      ucc.id,
      ucc.user_id,
      ucc.comercializadora_id,
      ucc.segment,
      c.name AS comercializadora_name,
      ucc.commission_type,
      ucc.commission_value,
      ucc.created_at,
      ucc.updated_at
    FROM user_company_commissions ucc
    LEFT JOIN comercializadoras c ON c.id = ucc.comercializadora_id
    ORDER BY ucc.user_id ASC, c.name ASC`,
    args: [],
  });

  return mapOverrideRows(response.rows);
}

/** Mezcla overrides y valores por defecto. El override siempre gana. */
export function mergeCommissions(
  userId: string,
  overrides: UserCompanyCommission[],
  defaults: DefaultCompanyCommission[],
): UserCompanyCommission[] {
  const overriddenCompanies = new Set(
    overrides.map((override) =>
      commissionKey(override.comercializadora_id, override.segment),
    ),
  );

  const inherited = defaults
    .filter(
      (fallback) =>
        !overriddenCompanies.has(
          commissionKey(fallback.comercializadora_id, fallback.segment),
        ),
    )
    .map((fallback) => ({
      id: fallback.id,
      user_id: userId,
      comercializadora_id: fallback.comercializadora_id,
      comercializadora_name: fallback.comercializadora_name ?? null,
      segment: fallback.segment,
      commission_type: fallback.commission_type,
      commission_value: fallback.commission_value,
      created_at: fallback.created_at,
      updated_at: fallback.updated_at,
      source: "default" as const,
    }));

  return [...overrides, ...inherited].sort((a, b) =>
    (a.comercializadora_name ?? "").localeCompare(b.comercializadora_name ?? ""),
  );
}

/** Comisiones que realmente se aplican a un colaborador, con herencia resuelta. */
export async function getEffectiveCommissions(
  tursoClient: Client,
  userId: string,
): Promise<UserCompanyCommission[]> {
  const [overrides, defaults] = await Promise.all([
    getUserCommissionOverrides(tursoClient, userId),
    getDefaultCommissions(tursoClient),
  ]);

  return mergeCommissions(userId, overrides, defaults);
}

async function runAtomically(tursoClient: Client, statements: InStatement[]) {
  const transaction = await tursoClient.transaction("write");
  try {
    for (const statement of statements) await transaction.execute(statement);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

/** Reemplaza por completo los valores por defecto de la asesoría. */
export async function replaceDefaultCommissions(
  tursoClient: Client,
  defaults: {
    comercializadora_id: string;
    segment: CommissionSegment;
    commission_type: CommissionType;
    commission_value: number;
  }[],
) {
  const statements: InStatement[] = [
    { sql: "DELETE FROM default_company_commissions", args: [] },
    ...defaults.map((fallback) => ({
      sql: `INSERT INTO default_company_commissions (
        id,
        comercializadora_id,
        segment,
        commission_type,
        commission_value,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        crypto.randomUUID(),
        fallback.comercializadora_id,
        fallback.segment,
        fallback.commission_type,
        fallback.commission_value,
      ],
    })),
  ];

  const users = await tursoClient.execute("SELECT id FROM user WHERE role = '2'");
  await runAtomically(tursoClient, [
    ...statements,
    ...enqueueCommissionSyncStatements(users.rows.map((row) => String(row.id))),
  ]);
}

interface BulkCommissionInput {
  userIds: string[];
  comercializadoraIds: string[];
  segments: CommissionSegment[];
  mode: CommissionApplyMode;
  commissionType?: CommissionType;
  commissionValue?: number;
}

/**
 * Aplica una misma comisión a varios colaboradores de golpe.
 * - overwrite: crea o pisa el override de cada colaborador.
 * - only_missing: solo crea el override si el colaborador aún no tenía uno.
 * - inherit: borra los overrides para que vuelvan al valor por defecto.
 */
export async function applyBulkCommissions(
  tursoClient: Client,
  { userIds, comercializadoraIds, segments, mode, commissionType, commissionValue }: BulkCommissionInput,
) {
  let statementCount = 0;

  for (const userId of userIds) {
    const statements: InStatement[] = [];
    for (const comercializadoraId of comercializadoraIds) {
      for (const segment of segments) {
      if (mode === "inherit") {
        statements.push({
          sql: `DELETE FROM user_company_commissions
            WHERE user_id = ? AND comercializadora_id = ? AND segment = ?`,
          args: [userId, comercializadoraId, segment],
        });
        continue;
      }

      const conflictClause =
        mode === "only_missing"
          ? "DO NOTHING"
          : `DO UPDATE SET
              commission_type = excluded.commission_type,
              commission_value = excluded.commission_value,
              updated_at = CURRENT_TIMESTAMP`;

      statements.push({
        sql: `INSERT INTO user_company_commissions (
          id,
          user_id,
          comercializadora_id,
          segment,
          commission_type,
          commission_value,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, comercializadora_id, segment) ${conflictClause}`,
        args: [
          crypto.randomUUID(),
          userId,
          comercializadoraId,
          segment,
          commissionType ?? "percent",
          commissionValue ?? 0,
        ],
      });
      }
    }
    statements.push(...enqueueCommissionSyncStatements([userId]));
    await tursoClient.batch(statements, "write");
    statementCount += statements.length - 1;
  }

  return statementCount;
}
