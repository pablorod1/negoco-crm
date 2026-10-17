import type { Client } from "@libsql/client";
import type { AncillarySimulation } from "./ranking";

type QueryClient = Pick<Client, "execute">;

const ANCILLARY_DEFAULT = "ancillary_default";

/** La tabla de la migración 029 aún no está en este tenant. */
const missingTable = (error: unknown) => error instanceof Error && /no such table: comparador_settings/i.test(error.message);

/** Valida y limpia unos SSAA: €/MWh entre 0 y 200; null si no queda ningún valor. */
export function cleanAncillary(value: unknown): AncillarySimulation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AncillarySimulation>;
  const number = (item: unknown) =>
    typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= 200 ? Math.round(item * 100) / 100 : null;
  const averagePerMwh = number(raw.averagePerMwh);
  const monthly = Array.isArray(raw.monthlyPerMwh) ? Array.from({ length: 12 }, (_, month) => number(raw.monthlyPerMwh![month])) : null;
  const monthlyPerMwh = monthly?.some((item) => item !== null) ? monthly : null;
  if (averagePerMwh === null && monthlyPerMwh === null) return null;
  return { averagePerMwh: monthlyPerMwh ? null : averagePerMwh, monthlyPerMwh };
}

/** Los SSAA por defecto del tenant; null si no hay, o si falta la tabla. */
export async function getDefaultAncillary(client: QueryClient): Promise<AncillarySimulation | null> {
  try {
    const { rows } = await client.execute({
      sql: "SELECT value FROM comparador_settings WHERE key = ? LIMIT 1",
      args: [ANCILLARY_DEFAULT],
    });
    if (!rows[0]) return null;
    return cleanAncillary(JSON.parse(String(rows[0].value)));
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

export class SettingsUnavailableError extends Error {
  constructor() {
    super("Falta la migración 029 (comparador_settings) en este tenant.");
    this.name = "SettingsUnavailableError";
  }
}

/** Guarda (o quita, con null) los SSAA por defecto del tenant. */
export async function setDefaultAncillary(client: QueryClient, value: AncillarySimulation | null, userId: string) {
  try {
    if (!value) {
      await client.execute({ sql: "DELETE FROM comparador_settings WHERE key = ?", args: [ANCILLARY_DEFAULT] });
      return;
    }
    await client.execute({
      sql: `INSERT INTO comparador_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
      args: [ANCILLARY_DEFAULT, JSON.stringify(value), userId],
    });
  } catch (error) {
    if (missingTable(error)) throw new SettingsUnavailableError();
    throw error;
  }
}

// ── Fee de los productos de precio base ─────────────────────────────────────

/**
 * Lo que decide cada agencia sobre el fee que suma a un precio base: el
 * habitual (el que se aplica si el comercial no pone otro) y el máximo. Los
 * anexos no los traen: «te lo tendrá que decir cada canal» (Jorge, Beenergy).
 */
export interface FeePolicy {
  /** €/MWh que se aplican si el comercial no escribe otro. */
  habitual: number | null;
  /** €/MWh como mucho; null: sin tope. */
  max: number | null;
}

export interface FeePolicies {
  /** Para las comercializadoras sin uno propio. */
  general: Pick<FeePolicy, "habitual">;
  bySupplier: Record<string, FeePolicy>;
}

const FEE_GENERAL = "fee_default";
const FEE_SUPPLIER_PREFIX = "fee:";

/** €/MWh entre 0 y 500, con dos decimales; null si no es un número válido. */
function cleanFee(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 500 ? Math.round(value * 100) / 100 : null;
}

export function cleanFeePolicy(value: unknown): FeePolicy {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<FeePolicy>;
  const habitual = cleanFee(raw.habitual);
  const max = cleanFee(raw.max);
  // Un habitual por encima del máximo no se podría aplicar.
  return { habitual: habitual !== null && max !== null ? Math.min(habitual, max) : habitual, max };
}

/** El fee de la agencia: el general y el de cada comercializadora. Vacío si falta la tabla. */
export async function getFeePolicies(client: QueryClient): Promise<FeePolicies> {
  const policies: FeePolicies = { general: { habitual: null }, bySupplier: {} };
  try {
    const { rows } = await client.execute({
      sql: "SELECT key, value FROM comparador_settings WHERE key = ? OR key LIKE ?",
      args: [FEE_GENERAL, `${FEE_SUPPLIER_PREFIX}%`],
    });
    for (const row of rows) {
      const key = String(row.key);
      const value = cleanFeePolicy(JSON.parse(String(row.value)));
      if (key === FEE_GENERAL) policies.general = { habitual: value.habitual };
      else policies.bySupplier[key.slice(FEE_SUPPLIER_PREFIX.length)] = value;
    }
    return policies;
  } catch (error) {
    if (missingTable(error)) return policies;
    throw error;
  }
}

/** El fee que vale para una comercializadora: el suyo y, si no tiene habitual, el general. */
export function feePolicyFor(policies: FeePolicies | undefined, comercializadoraId: string): FeePolicy {
  const own = policies?.bySupplier[comercializadoraId];
  return { habitual: own?.habitual ?? policies?.general.habitual ?? null, max: own?.max ?? null };
}

/** Guarda el fee general (comercializadoraId null) o el de una comercializadora; vacío lo quita. */
export async function setFeePolicy(
  client: QueryClient,
  comercializadoraId: string | null,
  value: FeePolicy,
  userId: string,
) {
  const key = comercializadoraId ? `${FEE_SUPPLIER_PREFIX}${comercializadoraId}` : FEE_GENERAL;
  const clean = cleanFeePolicy(value);
  try {
    if (clean.habitual === null && (clean.max === null || !comercializadoraId)) {
      await client.execute({ sql: "DELETE FROM comparador_settings WHERE key = ?", args: [key] });
      return;
    }
    await client.execute({
      sql: `INSERT INTO comparador_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
      args: [key, JSON.stringify(comercializadoraId ? clean : { habitual: clean.habitual, max: null }), userId],
    });
  } catch (error) {
    if (missingTable(error)) throw new SettingsUnavailableError();
    throw error;
  }
}
