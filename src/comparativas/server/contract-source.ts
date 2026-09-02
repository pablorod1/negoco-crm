import type { Client } from "@libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { completeCommissionPlans } from "@/comparativas/utils/commission-completeness";

export class ComparisonSourceError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

/** Re-read with the creation transaction before inserting any contract data. */
export async function getComparisonContractSource(
  db: Pick<Client, "execute">,
  id: string,
  plan: unknown,
  actor: { id: string; role: string },
  status: unknown,
  expectedOwner?: string,
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || (plan !== "fijo" && plan !== "indexado")) {
    throw new ComparisonSourceError(400, "Invalid comparison source");
  }
  const actorResult = await db.execute({ sql: "SELECT role FROM user WHERE id = ?", args: [actor.id] });
  const currentRole = String(actorResult.rows[0]?.role ?? "");
  if (!["admin", "1", "2"].includes(currentRole)) throw new ComparisonSourceError(403, "Forbidden");
  const result = await db.execute({
    sql: `SELECT c.*, u.name AS owner_name FROM comparativas c JOIN user u ON u.id = c.user_id WHERE c.id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) throw new ComparisonSourceError(404, "Comparativa no encontrada");
  const owner = String(row.user_id);
  if (currentRole === "2") {
    const subordinates = await getSubcomerciales(db, actor.id);
    if (owner !== actor.id && !(subordinates.success && subordinates.ids.includes(owner))) {
      throw new ComparisonSourceError(403, "Forbidden");
    }
  }
  if (expectedOwner !== undefined && owner !== expectedOwner) throw new ComparisonSourceError(409, "La comparativa ha cambiado");
  let plans: unknown;
  try { plans = JSON.parse(String(row.plan)); } catch { plans = null; }
  if (row.status !== "completed" || !Array.isArray(plans) || !plans.includes(plan) || !completeCommissionPlans(row)[plan]) {
    throw new ComparisonSourceError(409, "El plan no está listo para crear un trámite");
  }
  if (currentRole === "2" && status !== "Borrador" && status !== "Tramitable") {
    throw new ComparisonSourceError(403, "Forbidden");
  }
  return {
    comision: Number(row[`comision_${plan}`]),
    comision_sales_person: Number(row[`comision_sales_person_${plan}`]),
    user_id: owner,
    sales_name: String(row.owner_name),
  };
}
