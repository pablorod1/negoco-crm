import type { Client, InStatement, Row } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { EnergyByPeriod } from "@/comparador/engine/types";

type QueryClient = Pick<Client, "execute" | "batch">;

/**
 * Histórico del indexado: lo que cobró una tarifa indexada por la energía cada
 * mes, por periodo, en €/kWh. Es de una tarifa o, con `rateId` null, de toda la
 * comercializadora (vale para las indexadas sin histórico propio).
 */
export interface IndexHistoryMonth {
  /** YYYY-MM. */
  month: string;
  energy: EnergyByPeriod;
}

export interface IndexHistoryRow extends IndexHistoryMonth {
  id: string;
  comercializadoraId: string;
  rateId: string | null;
  accessTariff: string;
  source: "manual" | "document";
  ingestId: string | null;
  updatedAt: string;
}

/** Precio de la energía plausible para un mes de indexado, en €/kWh (como en las fijas). */
const ENERGY_RANGE = { min: 0.02, max: 0.6 };
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Por qué un mes no vale; null si está bien. */
export function indexMonthProblem({ month, energy }: IndexHistoryMonth): string | null {
  if (!MONTH.test(month)) return `«${month}» no es un mes (AAAA-MM).`;
  const values = [energy.P1, energy.P2, energy.P3];
  if (!values.every((value) => Number.isFinite(value) && value >= ENERGY_RANGE.min && value <= ENERGY_RANGE.max)) {
    return `${month}: la energía tiene que estar entre ${ENERGY_RANGE.min} y ${ENERGY_RANGE.max} €/kWh (${values.join(" / ")}). ¿Está en €/MWh o céntimos?`;
  }
  return null;
}

/** La tabla de la migración 030 aún no está en este tenant. */
const missingTable = (error: unknown) =>
  error instanceof Error && /no such table: comercializadora_index_history/i.test(error.message);

export class IndexHistoryUnavailableError extends Error {
  constructor() {
    super("Falta la migración 030 (comercializadora_index_history) en este tenant.");
    this.name = "IndexHistoryUnavailableError";
  }
}

function toRow(row: Row): IndexHistoryRow {
  return {
    id: String(row.id),
    comercializadoraId: String(row.comercializadora_id),
    rateId: row.rate_id === null || row.rate_id === undefined ? null : String(row.rate_id),
    accessTariff: String(row.access_tariff),
    month: String(row.month),
    energy: { P1: Number(row.energy_p1), P2: Number(row.energy_p2), P3: Number(row.energy_p3) },
    source: String(row.source) === "document" ? "document" : "manual",
    ingestId: row.ingest_id === null || row.ingest_id === undefined ? null : String(row.ingest_id),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Histórico de una comercializadora, o de todas sin `comercializadoraId`. Sin
 * la tabla, vacío: el comparador sigue funcionando, sin ofertar indexadas.
 */
export async function listIndexHistory(
  client: Pick<Client, "execute">,
  comercializadoraId?: string,
): Promise<IndexHistoryRow[]> {
  try {
    const { rows } = await client.execute({
      sql: `SELECT * FROM comercializadora_index_history
        ${comercializadoraId ? "WHERE comercializadora_id = ?" : ""}
        ORDER BY comercializadora_id, rate_id, month`,
      args: comercializadoraId ? [comercializadoraId] : [],
    });
    return rows.map(toRow);
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

/** Guarda unos meses del histórico: cada mes sustituye al que hubiera. */
export async function saveIndexHistory(
  client: QueryClient,
  {
    comercializadoraId,
    rateId,
    months,
    source,
    ingestId = null,
    userId,
  }: {
    comercializadoraId: string;
    rateId: string | null;
    months: readonly IndexHistoryMonth[];
    source: IndexHistoryRow["source"];
    ingestId?: string | null;
    userId: string;
  },
) {
  const statements: InStatement[] = months.flatMap(({ month, energy }) => [
    {
      sql: `DELETE FROM comercializadora_index_history
        WHERE comercializadora_id = ? AND COALESCE(rate_id, '') = ? AND access_tariff = '2.0TD' AND month = ?`,
      args: [comercializadoraId, rateId ?? "", month],
    },
    {
      sql: `INSERT INTO comercializadora_index_history
        (id, comercializadora_id, rate_id, access_tariff, month, energy_p1, energy_p2, energy_p3, source, ingest_id, created_by)
        VALUES (?, ?, ?, '2.0TD', ?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), comercializadoraId, rateId, month, energy.P1, energy.P2, energy.P3, source, ingestId, userId],
    },
  ]);
  if (statements.length === 0) return;
  try {
    await client.batch(statements, "write");
  } catch (error) {
    if (missingTable(error)) throw new IndexHistoryUnavailableError();
    throw error;
  }
}

/** Quita un mes del histórico. */
export async function deleteIndexHistoryMonth(
  client: QueryClient,
  { comercializadoraId, rateId, month }: { comercializadoraId: string; rateId: string | null; month: string },
) {
  try {
    await client.execute({
      sql: `DELETE FROM comercializadora_index_history
        WHERE comercializadora_id = ? AND COALESCE(rate_id, '') = ? AND month = ?`,
      args: [comercializadoraId, rateId ?? "", month],
    });
  } catch (error) {
    if (missingTable(error)) throw new IndexHistoryUnavailableError();
    throw error;
  }
}

/**
 * Los meses que valen para una tarifa: los suyos y, para los que no tenga, los
 * de su comercializadora.
 */
export function historyForRate(
  rows: readonly IndexHistoryRow[],
  comercializadoraId: string,
  rateId: string,
): Map<string, EnergyByPeriod> {
  const months = new Map<string, EnergyByPeriod>();
  for (const row of rows) {
    if (row.comercializadoraId === comercializadoraId && row.rateId === null) months.set(row.month, row.energy);
  }
  for (const row of rows) {
    if (row.comercializadoraId === comercializadoraId && row.rateId === rateId) months.set(row.month, row.energy);
  }
  return months;
}
