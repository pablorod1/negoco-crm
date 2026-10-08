import type { Client, Row } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { CostBreakdown, EnergyByPeriod, PowerByPeriod, TariffPrices } from "@/comparador/engine/types";
import type { StudyOffer } from "./ranking";
import type { StudyRecord } from "./repository";
import type { StudySupply } from "./supply";

type QueryClient = Pick<Client, "execute">;

/**
 * Lo que enseña el PDF de una propuesta, tal como se vio al generarla. No
 * lleva la comisión ni el fee: el PDF es para el cliente.
 */
export interface ProposalDocument {
  version: 1;
  number: number;
  generatedAt: string;
  /** Fecha de los precios (YYYY-MM-DD). */
  priceDate: string;
  client: { name: string | null; cups: string | null };
  supply: {
    contractedKw: PowerByPeriod;
    annualKwh: EnergyByPeriod;
    consumptionSource: StudySupply["consumptionSource"];
    sipsMonths: number | null;
    territory: StudySupply["territory"];
    power: { status: "adequate" | "oversized" | "exceeded"; maxDemandKw: number; suggestedKw: number } | null;
  };
  /** Lo que paga hoy en un año; null si la factura no da todos sus precios. */
  current: { supplierName: string | null; prices: TariffPrices | null; cost: CostBreakdown } | null;
  offer: {
    comercializadoraName: string;
    productName: string;
    termMonths: number | null;
    powerMode: StudyOffer["powerMode"];
    discounts: string[];
    prices: TariffPrices;
    cost: CostBreakdown;
  };
  savings: number | null;
}

export interface ProposalRecord {
  id: string;
  studyId: string;
  number: number;
  offerKey: string;
  comercializadoraId: string;
  comercializadoraName: string;
  productName: string;
  feeEnergyPerMwh: number;
  annualTotal: number;
  savings: number | null;
  commission: number | null;
  document: ProposalDocument;
  chosenAt: string | null;
  comparativaFileId: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** La foto de una oferta para el PDF. */
export function buildProposalDocument({
  study,
  offer,
  current,
  currentPrices,
  clientName,
  number,
  generatedAt,
}: {
  study: StudyRecord;
  offer: StudyOffer;
  current: CostBreakdown | null;
  currentPrices: TariffPrices | null;
  clientName: string | null;
  number: number;
  generatedAt: string;
}): ProposalDocument {
  const supply = study.supply!;
  return {
    version: 1,
    number,
    generatedAt,
    priceDate: study.priceDate,
    client: { name: clientName, cups: study.cups },
    supply: {
      contractedKw: supply.contractedKw,
      annualKwh: supply.annualKwh,
      consumptionSource: supply.consumptionSource,
      sipsMonths: supply.sipsMonths,
      territory: supply.territory,
      power: supply.power
        ? {
            status: supply.power.status,
            maxDemandKw: supply.power.maxDemandKw,
            suggestedKw: supply.power.suggestedKw,
          }
        : null,
    },
    current: current
      ? { supplierName: study.extraction?.supplierName ?? null, prices: currentPrices, cost: current }
      : null,
    offer: {
      comercializadoraName: offer.comercializadoraName,
      productName: offer.productName,
      termMonths: offer.termMonths,
      powerMode: offer.powerMode,
      discounts: offer.discounts,
      prices: offer.prices,
      cost: offer.cost,
    },
    savings: offer.savings,
  };
}

const str = (value: unknown) => (value === null || value === undefined ? null : String(value));
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function toProposal(row: Row): ProposalRecord {
  return {
    id: String(row.id),
    studyId: String(row.study_id),
    number: Number(row.number),
    offerKey: String(row.offer_key),
    comercializadoraId: String(row.comercializadora_id),
    comercializadoraName: String(row.comercializadora_name),
    productName: String(row.product_name),
    feeEnergyPerMwh: Number(row.fee_energy_per_mwh ?? 0),
    annualTotal: Number(row.annual_total),
    savings: num(row.savings),
    commission: num(row.commission),
    document: JSON.parse(String(row.document)) as ProposalDocument,
    chosenAt: str(row.chosen_at),
    comparativaFileId: str(row.comparativa_file_id),
    createdBy: str(row.created_by),
    createdAt: String(row.created_at),
  };
}

export async function listProposals(client: QueryClient, studyId: string): Promise<ProposalRecord[]> {
  const { rows } = await client.execute({
    sql: "SELECT * FROM comparison_study_proposals WHERE study_id = ? ORDER BY number",
    args: [studyId],
  });
  return rows.map(toProposal);
}

export async function getProposal(client: QueryClient, id: string): Promise<ProposalRecord | null> {
  const { rows } = await client.execute({
    sql: "SELECT * FROM comparison_study_proposals WHERE id = ? LIMIT 1",
    args: [id],
  });
  return rows[0] ? toProposal(rows[0]) : null;
}

/** Dos propuestas son la misma si la oferta, el fee y el coste coinciden. */
export function findSameProposal(proposals: readonly ProposalRecord[], offer: StudyOffer) {
  return proposals.find(
    (proposal) =>
      proposal.offerKey === offer.key &&
      proposal.feeEnergyPerMwh === offer.feeEnergyPerMwh &&
      proposal.annualTotal === offer.cost.total,
  );
}

const isNumberTaken = (error: unknown) =>
  error instanceof Error && /UNIQUE constraint failed: comparison_study_proposals\.study_id/.test(error.message);

/**
 * Guarda una propuesta nueva con el siguiente número del estudio. Si dos
 * llegan a la vez y se llevan el mismo número, la segunda lo vuelve a pedir.
 */
export async function createProposal(
  client: QueryClient,
  input: {
    study: StudyRecord;
    offer: StudyOffer;
    current: CostBreakdown | null;
    currentPrices: TariffPrices | null;
    clientName: string | null;
    createdBy: string;
    now?: Date;
  },
): Promise<ProposalRecord> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await insertProposal(client, input);
    } catch (error) {
      if (attempt >= 3 || !isNumberTaken(error)) throw error;
    }
  }
}

async function insertProposal(
  client: QueryClient,
  input: Parameters<typeof createProposal>[1],
): Promise<ProposalRecord> {
  const id = randomUUID();
  const { study, offer } = input;
  const next = await client.execute({
    sql: "SELECT COALESCE(MAX(number), 0) + 1 AS next FROM comparison_study_proposals WHERE study_id = ?",
    args: [study.id],
  });
  const number = Number(next.rows[0]?.next ?? 1);
  const document = buildProposalDocument({
    study,
    offer,
    current: input.current,
    currentPrices: input.currentPrices,
    clientName: input.clientName,
    number,
    generatedAt: (input.now ?? new Date()).toISOString(),
  });
  await client.execute({
    sql: `INSERT INTO comparison_study_proposals (
        id, study_id, number, offer_key, comercializadora_id, comercializadora_name,
        product_name, fee_energy_per_mwh, annual_total, savings, commission, document, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      study.id,
      number,
      offer.key,
      offer.comercializadoraId,
      offer.comercializadoraName,
      offer.productName,
      offer.feeEnergyPerMwh,
      offer.cost.total,
      offer.savings,
      offer.commission,
      JSON.stringify(document),
      input.createdBy,
    ],
  });
  return (await getProposal(client, id))!;
}

/** Nombre del PDF: «Propuesta 2 - Eleia - TRADERPOOL 3.pdf», sin caracteres raros. */
export function proposalFileName(proposal: Pick<ProposalRecord, "number" | "comercializadoraName" | "productName">) {
  const clean = (text: string) =>
    text
      .replace(/[^\p{L}\p{N} .,()+-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  return `Propuesta ${proposal.number} - ${clean(proposal.comercializadoraName)} - ${clean(proposal.productName)}`
    .slice(0, 120)
    .concat(".pdf");
}
