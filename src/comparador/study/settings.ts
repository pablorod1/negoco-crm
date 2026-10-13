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
