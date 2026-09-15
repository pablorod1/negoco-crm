import type { Client, InStatement } from "@libsql/client";
import { executeReadWithRetry } from "@/core/libsql/executeWithRetry";
import type {
  CommissionType,
  DefaultCompanyCommission,
  UserCompanyCommission,
} from "@/core/types";

/**
 * Las comisiones se resuelven en dos niveles:
 *   1. override del colaborador (user_company_commissions)
 *   2. valor por defecto de la asesoría (default_company_commissions)
 * Si el colaborador no tiene fila propia para una comercializadora, hereda el
 * valor por defecto. Así cambiar el porcentaje "para todos" es una sola edición.
 */

/** Máximo de sentencias por batch para no reventar el límite de la request de Turso. */
const BATCH_CHUNK_SIZE = 100;

export type CommissionApplyMode = "overwrite" | "only_missing" | "inherit";

function toCommissionType(value: unknown): CommissionType {
  return String(value) === "fixed" ? "fixed" : "percent";
}

export async function getDefaultCommissions(
  tursoClient: Client,
): Promise<DefaultCompanyCommission[]> {
  const response = await executeReadWithRetry(tursoClient, {
    sql: `SELECT
      dcc.id,
      dcc.comercializadora_id,
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

  return response.rows.map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    comercializadora_id: String(row.comercializadora_id),
    comercializadora_name: row.comercializadora_name
      ? String(row.comercializadora_name)
      : null,
    commission_type: toCommissionType(row.commission_type),
    commission_value: Number(row.commission_value) || 0,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    source: "user" as const,
  }));
}

/** Mezcla overrides y valores por defecto. El override siempre gana. */
export function mergeCommissions(
  userId: string,
  overrides: UserCompanyCommission[],
  defaults: DefaultCompanyCommission[],
): UserCompanyCommission[] {
  const overriddenCompanies = new Set(
    overrides.map((override) => override.comercializadora_id),
  );

  const inherited = defaults
    .filter((fallback) => !overriddenCompanies.has(fallback.comercializadora_id))
    .map((fallback) => ({
      id: fallback.id,
      user_id: userId,
      comercializadora_id: fallback.comercializadora_id,
      comercializadora_name: fallback.comercializadora_name ?? null,
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

async function runInChunks(tursoClient: Client, statements: InStatement[]) {
  for (let index = 0; index < statements.length; index += BATCH_CHUNK_SIZE) {
    await tursoClient.batch(
      statements.slice(index, index + BATCH_CHUNK_SIZE),
      "write",
    );
  }
}

/** Reemplaza por completo los valores por defecto de la asesoría. */
export async function replaceDefaultCommissions(
  tursoClient: Client,
  defaults: {
    comercializadora_id: string;
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
        commission_type,
        commission_value,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        crypto.randomUUID(),
        fallback.comercializadora_id,
        fallback.commission_type,
        fallback.commission_value,
      ],
    })),
  ];

  await runInChunks(tursoClient, statements);
}

interface BulkCommissionInput {
  userIds: string[];
  comercializadoraIds: string[];
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
  { userIds, comercializadoraIds, mode, commissionType, commissionValue }: BulkCommissionInput,
) {
  const statements: InStatement[] = [];

  for (const userId of userIds) {
    for (const comercializadoraId of comercializadoraIds) {
      if (mode === "inherit") {
        statements.push({
          sql: `DELETE FROM user_company_commissions
            WHERE user_id = ? AND comercializadora_id = ?`,
          args: [userId, comercializadoraId],
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
          commission_type,
          commission_value,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, comercializadora_id) ${conflictClause}`,
        args: [
          crypto.randomUUID(),
          userId,
          comercializadoraId,
          commissionType ?? "percent",
          commissionValue ?? 0,
        ],
      });
    }
  }

  await runInChunks(tursoClient, statements);
  return statements.length;
}
