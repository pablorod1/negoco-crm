import type { ProposalView, StudyView } from "@/comparador/server/study-route";
import type { StudyClientDataInput } from "@/comparador/study/client-data";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";

export type { ProposalView, StudyView };
export type StudyOfferView = StudyView["offers"][number];

export interface StudyOptionsInput {
  channel?: "acquisition" | "renewal" | null;
  feeEnergyPerMwh?: number | null;
  order?: "savings" | "commission";
}

export interface ComparativaStudies {
  service: string;
  clientName: string | null;
  /** Documentos que pueden ser la factura: PDF o foto. */
  invoices: { id: string; filename: string; extension: string; uploadDate: string; downloadUrl: string }[];
  studies: {
    id: string;
    status: string;
    createdAt: string;
    invoiceFileName: string | null;
    savings: number | null;
    chosenProduct: string | null;
  }[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
  if (!response.ok || !body?.data) {
    throw new Error(body?.error ?? "No se ha podido completar");
  }
  return body.data;
}

function query(options: StudyOptionsInput): string {
  const params = new URLSearchParams();
  if (options.feeEnergyPerMwh !== undefined) params.set("fee", options.feeEnergyPerMwh === null ? "" : String(options.feeEnergyPerMwh));
  if (options.order) params.set("order", options.order);
  if (options.channel !== undefined) params.set("channel", options.channel ?? "");
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const studyApi = {
  list: (comparativaId: string) =>
    request<ComparativaStudies>(`/api/v2/comparador/comparisons/${comparativaId}/studies`),
  /** Una factura adjunta, o la subida: un PDF o las fotos de sus páginas, en orden. */
  analyze: (comparativaId: string, invoice: { fileId: string } | { files: File[] }) => {
    const form = new FormData();
    if ("fileId" in invoice) form.set("fileId", invoice.fileId);
    else for (const file of invoice.files) form.append("file", file);
    return request<{ id: string }>(`/api/v2/comparador/comparisons/${comparativaId}/studies`, {
      method: "POST",
      body: form,
    });
  },
  view: (studyId: string, options: StudyOptionsInput = {}) =>
    request<StudyView>(`/api/v2/comparador/studies/${studyId}${query(options)}`),
  saveOptions: (studyId: string, options: StudyOptionsInput) =>
    request<{ options: StudyOptionsInput }>(`/api/v2/comparador/studies/${studyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    }),
  propose: (studyId: string, offerKey: string, options: StudyOptionsInput) =>
    request<ProposalView>(`/api/v2/comparador/studies/${studyId}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerKey, options }),
    }),
  /** Guarda los datos de la factura revisados; `acceptMismatch` si las cuentas siguen sin cuadrar. */
  reviewInvoice: (studyId: string, invoice: InvoiceExtraction, acceptMismatch: boolean) =>
    request<{ issues: number }>(`/api/v2/comparador/studies/${studyId}/invoice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice, acceptMismatch }),
    }),
  close: (studyId: string, proposalId: string, client: StudyClientDataInput | null) =>
    request<{ fileId: string }>(`/api/v2/comparador/studies/${studyId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId, client }),
    }),
};

export const euros = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2, useGrouping: "always" });

export const kwh = (value: number) => `${Math.round(value).toLocaleString("es-ES", { useGrouping: "always" })} kWh`;

/** Porcentaje entero de una parte sobre el total; 0 si el total no lo es. */
export const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Precio unitario con 4 a 6 decimales, como en la propuesta. */
export const unitPrice = (value: number) =>
  value.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 6 });

/** Euros sin céntimos, para cifras grandes y titulares. */
export const eurosRound = (value: number) =>
  value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });

export const kw = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 3 })} kW`;
