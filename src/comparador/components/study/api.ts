import type { ProposalView, StudyView } from "@/comparador/server/study-route";
import type { StudyClientDataInput } from "@/comparador/study/client-data";

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
  pdfs: { id: string; filename: string; uploadDate: string }[];
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
  analyze: (comparativaId: string, invoice: { fileId: string } | { file: File }) => {
    const form = new FormData();
    if ("fileId" in invoice) form.set("fileId", invoice.fileId);
    else form.set("file", invoice.file);
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
    : value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export const kwh = (value: number) => `${Math.round(value).toLocaleString("es-ES")} kWh`;
