import { NextResponse } from "next/server";
import { z } from "zod";
import type { NegocoStudiesContext } from "@/comparador/server/guard";
import { getStudyComparativa } from "@/comparador/study/comparativa";
import type { StudyRanking } from "@/comparador/study/ranking";
import type { ProposalRecord } from "@/comparador/study/proposals";
import { getStudy, type StudyRecord } from "@/comparador/study/repository";
import type { InvoiceIssue } from "@/comparador/extraction/validate";
import { issueMessages } from "@/comparador/extraction/issue-text";
import { StudyError } from "@/comparador/study/service";
import { needsInvoiceReview, withoutReview, type ReviewedExtraction } from "@/comparador/study/invoice-review";

/** Cuántas ofertas se enseñan: el resto no cambia la decisión. */
export const SHOWN_OFFERS = 150;

export function studyError(label: string, error: unknown) {
  if (error instanceof StudyError) {
    return NextResponse.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
  }
  console.error(`[comparador] ${label} failed`, error);
  return NextResponse.json({ error: "No se ha podido completar el estudio" }, { status: 500 });
}

/**
 * La comisión de agencia solo la ven admin y backoffice, como los precios de
 * compra; el comercial ve el ahorro.
 */
export function canSeeAgencyCommission(role: string): boolean {
  return role === "admin" || role === "1";
}

/**
 * Avisos de la factura en palabras. Los del titular y el CUPS no se enseñan:
 * se tapan antes de analizarla y el CUPS lo lee el CRM.
 */
export const describeInvoiceIssues = (issues: readonly InvoiceIssue[]) => issueMessages(issues);

/** Una propuesta generada, con el enlace a su PDF. */
export function proposalView(proposal: ProposalRecord, showCommission: boolean) {
  return {
    id: proposal.id,
    number: proposal.number,
    offerKey: proposal.offerKey,
    comercializadoraName: proposal.comercializadoraName,
    productName: proposal.productName,
    feeEnergyPerMwh: proposal.feeEnergyPerMwh,
    annualTotal: proposal.annualTotal,
    savings: proposal.savings,
    commission: showCommission ? proposal.commission : null,
    createdAt: proposal.createdAt,
    chosen: proposal.chosenAt !== null,
    pdfUrl: `/api/v2/comparador/proposals/${proposal.id}/pdf`,
  };
}

export type ProposalView = ReturnType<typeof proposalView>;

/** Lo que el panel necesita de un estudio, sin datos que no le tocan al usuario. */
export function studyView(
  study: StudyRecord,
  ranking: StudyRanking | null,
  showCommission: boolean,
  proposals: readonly ProposalRecord[] = [],
) {
  const facts = study.extraction;
  const review = (facts as ReviewedExtraction | null)?.review ?? null;
  const hide = <T extends { commission: number | null }>(item: T): T =>
    showCommission ? item : { ...item, commission: null };
  return {
    id: study.id,
    status: study.status,
    priceDate: study.priceDate,
    createdAt: study.createdAt,
    invoiceFileName: study.invoiceFileName,
    invoiceFileId: study.invoiceFileId,
    cups: study.cups,
    /** Datos del cliente: leídos de la factura al analizarla, o los confirmados al completar. */
    client: study.clientData,
    invoice: facts
      ? {
          supplierName: facts.supplierName,
          billingPeriod: facts.billingPeriod,
          total: facts.total,
          contractedKw: facts.contractedKw,
          consumptionKwh: facts.consumptionKwh,
          hasSelfConsumption: facts.hasSelfConsumption,
        }
      : null,
    issues: describeInvoiceIssues(study.issues),
    /** Lo leído de la factura, para revisarlo y corregirlo. */
    extraction: facts ? withoutReview(facts as ReviewedExtraction) : null,
    invoiceReview: {
      /** La lectura no cuadra y nadie la ha revisado: no hay ahorro hasta revisarla. */
      required: needsInvoiceReview(study),
      reviewedAt: review?.reviewedAt ?? null,
      reviewedByEmail: review?.reviewedByEmail ?? null,
      acceptedMismatch: review?.acceptedMismatch ?? false,
    },
    supply: study.supply,
    options: study.options,
    showCommission,
    current: ranking?.current ?? null,
    offers: ranking ? ranking.offers.slice(0, SHOWN_OFFERS).map(hide) : [],
    totalOffers: ranking?.offers.length ?? 0,
    ineligible: ranking?.ineligible ?? 0,
    noSavings: ranking?.noSavings ?? false,
    proposals: proposals.map((proposal) => proposalView(proposal, showCommission)),
  };
}

export type StudyView = ReturnType<typeof studyView>;

export const OptionsSchema = z.object({
  channel: z.enum(["acquisition", "renewal"]).nullable().optional(),
  feeEnergyPerMwh: z.number().min(0).max(200).nullable().optional(),
  order: z.enum(["savings", "commission"]).optional(),
});

/** El estudio y su comparativa, si este usuario puede verla. */
export async function loadStudyWithComparativa(context: NegocoStudiesContext, id: string) {
  const study = await getStudy(context.client, id);
  const comparativa = study ? await getStudyComparativa(context.client, study.comparativaId, context.user) : null;
  if (!study || !comparativa) throw new StudyError("Estudio no encontrado", 404);
  return { study, comparativa };
}

/** El estudio, si es de una comparativa que este usuario puede ver. */
export async function loadStudy(context: NegocoStudiesContext, id: string): Promise<StudyRecord> {
  return (await loadStudyWithComparativa(context, id)).study;
}
