import type { Client } from "@libsql/client";

/**
 * La comisión que ve cada usuario en el estudio. Dirección y backoffice ven
 * la de agencia (lo que paga la comercializadora). Un comercial ve la suya,
 * con la configuración de comisiones del CRM (Usuarios → comisiones): su
 * porcentaje de la comisión de agencia o un importe fijo, por comercializadora
 * y segmento; si no tiene propia, la de la asesoría; si tampoco hay, no ve
 * comisión. Es la misma regla que el comparador de Abarca
 * (comparativas/server/study-result.ts).
 */

type QueryClient = Pick<Client, "execute">;

export interface SalesCommissionRule {
  type: "percent" | "fixed";
  value: number;
}

export type CommissionAudience =
  | { kind: "agency" }
  /** Reglas del comercial por «comercializadora:segmento». */
  | { kind: "sales"; rules: ReadonlyMap<string, SalesCommissionRule> };

/** El segmento de la configuración del CRM: el comparador oferta 2.0TD y gas. */
const segmentOf = (energy: "electricity" | "gas") => (energy === "gas" ? "gas" : "luz_20td");
const keyOf = (comercializadoraId: string, segment: string) => `${comercializadoraId}:${segment}`;

/** Las reglas del comercial: las suyas y, donde no tiene, las de la asesoría. */
export async function loadSalesCommissionRules(client: QueryClient, userId: string): Promise<Map<string, SalesCommissionRule>> {
  const [defaults, own] = await Promise.all([
    client.execute("SELECT comercializadora_id, segment, commission_type, commission_value FROM default_company_commissions"),
    client.execute({
      sql: "SELECT comercializadora_id, segment, commission_type, commission_value FROM user_company_commissions WHERE user_id = ?",
      args: [userId],
    }),
  ]);
  const rules = new Map<string, SalesCommissionRule>();
  for (const row of [...defaults.rows, ...own.rows]) {
    const value = Number(row.commission_value);
    if (!Number.isFinite(value) || value < 0) continue;
    rules.set(keyOf(String(row.comercializadora_id), String(row.segment ?? "luz_20td")), {
      type: String(row.commission_type) === "fixed" ? "fixed" : "percent",
      value,
    });
  }
  return rules;
}

/** Quién mira el estudio: dirección y backoffice ven la de agencia; el resto, la suya. */
export async function commissionAudience(client: QueryClient, user: { id: string; role: string }): Promise<CommissionAudience> {
  if (user.role === "admin" || user.role === "1") return { kind: "agency" };
  return { kind: "sales", rules: await loadSalesCommissionRules(client, user.id) };
}

/**
 * La comisión del comercial en una oferta: su importe fijo o su porcentaje de
 * la de agencia; sin regla, o sin comisión de agencia, ninguna.
 */
export function salesCommission(
  rules: ReadonlyMap<string, SalesCommissionRule>,
  offer: { comercializadoraId: string; energy: "electricity" | "gas"; agencyCommission: number | null },
): number | null {
  const rule = rules.get(keyOf(offer.comercializadoraId, segmentOf(offer.energy)));
  // Sin comisión de agencia no hay de dónde pagar la suya, ni siquiera una fija (como en el CRM).
  if (!rule || offer.agencyCommission === null) return null;
  if (rule.type === "fixed") return Math.round(rule.value * 100) / 100;
  return Math.round(offer.agencyCommission * rule.value) / 100;
}
