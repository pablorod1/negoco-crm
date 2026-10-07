import type { Client, Row } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import type { InvoiceIssue } from "@/comparador/extraction/validate";
import type { StudyOffer, StudyOptions } from "./ranking";
import type { StudySupply } from "./supply";

type QueryClient = Pick<Client, "execute">;

export type StudyStatus = "analyzed" | "chosen" | "closed" | "failed";

/** Opciones que el usuario puede cambiar; la fecha es la del estudio. */
export type SavedStudyOptions = Omit<StudyOptions, "date">;

export interface StudyRecord {
  id: string;
  comparativaId: string;
  status: StudyStatus;
  invoiceFileId: string | null;
  invoiceFileName: string | null;
  cups: string | null;
  extraction: InvoiceExtraction | null;
  issues: InvoiceIssue[];
  supply: StudySupply | null;
  options: SavedStudyOptions;
  priceDate: string;
  chosenOffer: StudyOffer | null;
  currentTotal: number | null;
  chosenTotal: number | null;
  savings: number | null;
  commission: number | null;
  aiCostUsd: number | null;
  error: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_OPTIONS: SavedStudyOptions = { channel: null, feeEnergyPerMwh: null, order: "savings" };

function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const str = (value: unknown) => (value === null || value === undefined ? null : String(value));
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function toStudy(row: Row): StudyRecord {
  return {
    id: String(row.id),
    comparativaId: String(row.comparativa_id),
    status: String(row.status) as StudyStatus,
    invoiceFileId: str(row.invoice_file_id),
    invoiceFileName: str(row.invoice_file_name),
    cups: str(row.cups),
    extraction: json<InvoiceExtraction | null>(row.extraction, null),
    issues: json<InvoiceIssue[]>(row.issues, []),
    supply: json<StudySupply | null>(row.supply, null),
    options: { ...DEFAULT_OPTIONS, ...json<Partial<SavedStudyOptions>>(row.options, {}) },
    priceDate: String(row.price_date),
    chosenOffer: json<StudyOffer | null>(row.chosen_offer, null),
    currentTotal: num(row.current_total),
    chosenTotal: num(row.chosen_total),
    savings: num(row.savings),
    commission: num(row.commission),
    aiCostUsd: num(row.ai_cost_usd),
    error: str(row.error),
    createdBy: str(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function createStudy(
  client: QueryClient,
  input: {
    comparativaId: string;
    status: StudyStatus;
    invoiceFileId: string | null;
    invoiceFileName: string | null;
    cups: string | null;
    extraction: InvoiceExtraction | null;
    issues: InvoiceIssue[];
    supply: StudySupply | null;
    options: SavedStudyOptions;
    priceDate: string;
    aiCostUsd: number | null;
    error: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await client.execute({
    sql: `INSERT INTO comparison_studies (
        id, comparativa_id, status, invoice_file_id, invoice_file_name, cups,
        extraction, issues, supply, options, price_date, ai_cost_usd, error, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.comparativaId,
      input.status,
      input.invoiceFileId,
      input.invoiceFileName,
      input.cups,
      input.extraction ? JSON.stringify(input.extraction) : null,
      JSON.stringify(input.issues),
      input.supply ? JSON.stringify(input.supply) : null,
      JSON.stringify(input.options),
      input.priceDate,
      input.aiCostUsd,
      input.error,
      input.createdBy,
    ],
  });
  return id;
}

export async function getStudy(client: QueryClient, id: string): Promise<StudyRecord | null> {
  const { rows } = await client.execute({
    sql: "SELECT * FROM comparison_studies WHERE id = ? LIMIT 1",
    args: [id],
  });
  return rows[0] ? toStudy(rows[0]) : null;
}

export async function listStudies(client: QueryClient, comparativaId: string): Promise<StudyRecord[]> {
  const { rows } = await client.execute({
    sql: "SELECT * FROM comparison_studies WHERE comparativa_id = ? ORDER BY created_at DESC",
    args: [comparativaId],
  });
  return rows.map(toStudy);
}

export async function saveStudyOptions(client: QueryClient, id: string, options: SavedStudyOptions) {
  await client.execute({
    sql: "UPDATE comparison_studies SET options = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [JSON.stringify(options), id],
  });
}

/** Guarda la oferta elegida tal como se vio: precios, coste, ahorro y comisión. */
export async function chooseStudyOffer(
  client: QueryClient,
  id: string,
  { offer, currentTotal, options }: { offer: StudyOffer; currentTotal: number | null; options: SavedStudyOptions },
) {
  await client.execute({
    sql: `UPDATE comparison_studies SET status = 'chosen', chosen_offer = ?, options = ?,
        current_total = ?, chosen_total = ?, savings = ?, commission = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    args: [
      JSON.stringify(offer),
      JSON.stringify(options),
      currentTotal,
      offer.cost.total,
      offer.savings,
      offer.commission,
      id,
    ],
  });
}
