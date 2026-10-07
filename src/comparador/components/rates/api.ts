import type { DiffEntry } from "@/comparador/rates/diff";
import type { IngestReview } from "@/comparador/rates/service";
import type {
  CommissionRule,
  RateConditions,
  RatePrices,
  RateVersion,
  StoredRatePrice,
} from "@/comparador/rates/types";
import type { RateIssue } from "@/comparador/rates/validate";
import type { summarizeIngest } from "@/comparador/rates/views";

export type IngestSummary = ReturnType<typeof summarizeIngest>;
export type { DiffEntry, IngestReview, RateIssue, RateVersion, StoredRatePrice };

export interface SupplierRatesResponse {
  supplier: { id: string; name: string };
  rates: {
    catalogRateId: string | null;
    rateId: string | null;
    name: string;
    pricing: string;
    accessTariffs: string;
    catalogStatus: string | null;
    enabled: boolean;
    activeRows: number;
  }[];
  activeVersion: RateVersion | null;
  activePrices: StoredRatePrice[];
  versions: RateVersion[];
  ingests: IngestSummary[];
  commissionRules: CommissionRule[];
  freshness: { status: "never" | "fresh" | "stale"; days: number | null };
  medianDecisionHours: number | null;
  canManage: boolean;
  canManageCatalog: boolean;
}

export interface IngestDetailResponse {
  ingest: IngestSummary;
  originalUrl: string | null;
  bodyText: string | null;
  issues: RateIssue[] | null;
  review: IngestReview | null;
  canManage: boolean;
  canManageCatalog: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.error ?? "No se ha podido completar la operación");
  }
  return body.data as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const ratesApi = {
  supplier: (comercializadoraId: string) =>
    request<SupplierRatesResponse>(
      `/api/v2/comparador/rates?comercializadora_id=${encodeURIComponent(comercializadoraId)}`,
    ),
  upload: (form: FormData) =>
    request<{ id: string }>("/api/v2/comparador/rates/ingests", { method: "POST", body: form }),
  process: (id: string) =>
    request<{ id: string; status: string }>(`/api/v2/comparador/rates/ingests/${id}/process`, {
      method: "POST",
    }),
  ingest: (id: string) => request<IngestDetailResponse>(`/api/v2/comparador/rates/ingests/${id}`),
  preview: (id: string, decisions: { excludedRowKeys: string[]; regulatedPowerRowKeys: string[] }) =>
    request<{ review: IngestReview | null }>(
      `/api/v2/comparador/rates/ingests/${id}/preview`,
      json(decisions),
    ),
  approve: (
    id: string,
    input: {
      validFrom: string;
      excludedRowKeys: string[];
      regulatedPowerRowKeys: string[];
      includeCommissions: boolean;
    },
  ) =>
    request<{ versionId: string | null; status: string | null }>(
      `/api/v2/comparador/rates/ingests/${id}/approve`,
      json(input),
    ),
  reject: (id: string) =>
    request<{ id: string }>(`/api/v2/comparador/rates/ingests/${id}/reject`, { method: "POST" }),
  assignSupplier: (id: string, comercializadoraId: string) =>
    request<{ id: string }>(`/api/v2/comparador/rates/ingests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercializadora_id: comercializadoraId }),
    }),
  toggleRate: (rateId: string, comercializadoraId: string, enabled: boolean) =>
    request<{ rateId: string }>(`/api/v2/comparador/rates/tenant-rates/${rateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercializadora_id: comercializadoraId, enabled }),
    }),
  discardVersion: (versionId: string, comercializadoraId: string) =>
    request<{ id: string }>(
      `/api/v2/comparador/rates/versions/${versionId}?comercializadora_id=${encodeURIComponent(comercializadoraId)}`,
      { method: "DELETE" },
    ),
};

const TERRITORY: Record<string, string> = {
  baleares: "Baleares",
  canarias: "Canarias",
  ceuta_melilla: "Ceuta y Melilla",
};

const kwh = (value: number) => `${(value / 1000).toLocaleString("es-ES")} MWh`;

/** Condiciones de una fila en una línea: «Agencia · > 10 kW · hasta 8 MWh · 12 meses». */
export function describeConditions(
  row: RateConditions & Partial<Pick<RatePrices, "includesAncillaryServices" | "feeEnergyMinPerMwh" | "feeEnergyMaxPerMwh">>,
): string {
  const parts: string[] = [];
  if (row.level) parts.push(row.level);
  if (row.territory !== "peninsula") parts.push(TERRITORY[row.territory] ?? row.territory);
  if (row.channel) parts.push(row.channel === "acquisition" ? "Captación" : "Renovación");
  if (row.clientSegment) parts.push(row.clientSegment);
  if (row.minPowerKw || row.maxPowerKw !== null) {
    parts.push(
      row.minPowerKw && row.maxPowerKw !== null
        ? `> ${row.minPowerKw} y ≤ ${row.maxPowerKw} kW`
        : row.minPowerKw
          ? `> ${row.minPowerKw} kW`
          : `≤ ${row.maxPowerKw} kW`,
    );
  }
  if (row.minAnnualKwh || row.maxAnnualKwh !== null) {
    parts.push(
      row.minAnnualKwh && row.maxAnnualKwh !== null
        ? `${kwh(row.minAnnualKwh)}–${kwh(row.maxAnnualKwh)}`
        : row.minAnnualKwh
          ? `desde ${kwh(row.minAnnualKwh)}`
          : `hasta ${kwh(row.maxAnnualKwh!)}`,
    );
  }
  if (row.supplyStartFrom) parts.push(`inicio desde ${row.supplyStartFrom}`);
  if (row.termMonths) parts.push(`${row.termMonths} meses`);
  if (row.includesAncillaryServices === false) parts.push("sin SS.AA.");
  if (row.feeEnergyMinPerMwh !== null && row.feeEnergyMinPerMwh !== undefined) {
    parts.push(
      row.feeEnergyMaxPerMwh !== null && row.feeEnergyMaxPerMwh !== row.feeEnergyMinPerMwh
        ? `fee ${row.feeEnergyMinPerMwh}–${row.feeEnergyMaxPerMwh} €/MWh`
        : `fee ${row.feeEnergyMinPerMwh} €/MWh`,
    );
  }
  return parts.join(" · ") || "General";
}

export const formatPrice = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : value.toLocaleString("es-ES", { maximumFractionDigits: 6 });

export function describePower(row: Pick<RatePrices, "powerMode" | "power" | "powerMarginPerKwYear">) {
  if (row.powerMode === "regulated") return "Regulada (BOE)";
  if (row.powerMode === "regulated_plus") {
    return `BOE + ${formatPrice(row.powerMarginPerKwYear)} €/kW·año`;
  }
  return row.power ? `${formatPrice(row.power.P1)} / ${formatPrice(row.power.P2)}` : "—";
}
