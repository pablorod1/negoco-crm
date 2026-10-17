import { energyOfTariff } from "@/comparador/gas/regulated";
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
import type { AncillarySimulation } from "@/comparador/study/ranking";
import type { IndexHistoryMonth, IndexHistoryRow } from "@/comparador/rates/index-history";
import type { summarizeIngest } from "@/comparador/rates/views";

export type IngestSummary = ReturnType<typeof summarizeIngest>;
export type { AncillarySimulation, DiffEntry, IndexHistoryRow, IngestReview, RateIssue, RateVersion, StoredRatePrice };

export interface SupplierRatesResponse {
  supplier: { id: string; name: string; active: boolean };
  /** Tarifas con precios vigentes en este tenant, con sus filas. */
  rates: { rateId: string; name: string; enabled: boolean; rows: StoredRatePrice[] }[];
  activeVersion: RateVersion | null;
  activePrices: StoredRatePrice[];
  versions: RateVersion[];
  ingests: IngestSummary[];
  commissionRules: CommissionRule[];
  freshness: { status: "never" | "fresh" | "stale"; days: number | null };
  medianDecisionHours: number | null;
  /** Dirección a la que se envían los anexos (beenergy@tarifas.negococloud.es). */
  mailbox: string | null;
  /** SSAA por defecto del tenant para las tarifas que los cobran aparte. */
  ancillaryDefault: AncillarySimulation | null;
  /** Fee que la agencia suma a los precios base de esta comercializadora (€/MWh). */
  fee: {
    own: { habitual: number | null; max: number | null };
    general: number | null;
    effective: { habitual: number | null; max: number | null };
  };
  /** Histórico del indexado: de toda la comercializadora (rateId null) o de una tarifa. */
  indexHistory: IndexHistoryRow[];
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
  preview: (
    id: string,
    decisions: {
      excludedRowKeys: string[];
      regulatedPowerRowKeys: string[];
      manualPower: Record<string, { p1: number; p2: number }>;
      partialUpdate: boolean;
      levelMap: Record<string, string | null>;
    },
  ) =>
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
      manualPower: Record<string, { p1: number; p2: number }>;
      partialUpdate: boolean;
      includeCommissions: boolean;
      levelMap: Record<string, string | null>;
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
  saveAncillaryDefault: (value: AncillarySimulation | null) =>
    request<{ ancillaryDefault: AncillarySimulation | null }>("/api/v2/comparador/rates/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ancillaryDefault: value }),
    }),
  saveFee: (comercializadoraId: string | null, value: { habitual: number | null; max?: number | null }) =>
    request<unknown>("/api/v2/comparador/rates/fee", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercializadoraId, ...value }),
    }),
  saveIndexHistory: (comercializadoraId: string, rateId: string | null, months: IndexHistoryMonth[]) =>
    request<{ saved: number }>("/api/v2/comparador/rates/index-history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercializadora_id: comercializadoraId, rate_id: rateId, months }),
    }),
  deleteIndexHistoryMonth: (comercializadoraId: string, rateId: string | null, month: string) =>
    request<{ month: string }>("/api/v2/comparador/rates/index-history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercializadora_id: comercializadoraId, rate_id: rateId, month }),
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

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Precio que depende del mes en que empieza el suministro (Axpo da uno por
 * mes de inicio): «si empieza en noviembre de 2026». No es la fecha en que
 * entran en vigor los precios.
 */
export function describeSupplyStart(from: string | null, to: string | null): string | null {
  if (!from) return null;
  const [year, month, day] = from.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day === 1 && to === `${from.slice(0, 8)}${String(lastDay).padStart(2, "0")}`) {
    return `si empieza en ${MONTHS[month - 1]} de ${year}`;
  }
  return to ? `si empieza del ${formatDay(from)} al ${formatDay(to)}` : `si empieza desde el ${formatDay(from)}`;
}

/** Condiciones de una fila en una línea: «Agencia · > 10 kW · hasta 8 MWh · 12 meses». */
export function describeConditions(
  row: RateConditions &
    Partial<Pick<RatePrices, "includesAncillaryServices" | "feeEnergyMinPerMwh" | "feeEnergyMaxPerMwh">> & { accessTariff?: string },
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
  const start = describeSupplyStart(row.supplyStartFrom, row.supplyStartTo);
  if (start) parts.push(start);
  if (row.termMonths) parts.push(`${row.termMonths} meses`);
  // En gas el campo dice si el variable lleva los peajes.
  if (row.includesAncillaryServices === false) parts.push(row.accessTariff && energyOfTariff(row.accessTariff) === "gas" ? "variable sin peajes" : "sin SS.AA.");
  if (row.feeEnergyMinPerMwh !== null && row.feeEnergyMinPerMwh !== undefined) {
    parts.push(
      row.feeEnergyMaxPerMwh !== null && row.feeEnergyMaxPerMwh !== row.feeEnergyMinPerMwh
        ? `fee ${row.feeEnergyMinPerMwh}–${row.feeEnergyMaxPerMwh} €/MWh`
        : `fee ${row.feeEnergyMinPerMwh} €/MWh`,
    );
  }
  return parts.join(" · ") || "General";
}

/** «2026-10-07» como se lee en España: «07/10/2026». */
export const formatDay = (day: string | null | undefined) => {
  const match = day ? /^(\d{4})-(\d{2})-(\d{2})/.exec(day) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (day ?? "");
};

/** Una marca de la base («2026-10-07 18:42:19», en UTC) en hora de España. */
export const formatMoment = (stamp: string | null | undefined) => {
  if (!stamp) return "";
  const date = new Date(`${stamp.replace(" ", "T")}${/Z|[+-]\d\d:?\d\d$/.test(stamp) ? "" : "Z"}`);
  if (Number.isNaN(date.getTime())) return stamp;
  return date.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatPrice = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : value.toLocaleString("es-ES", { maximumFractionDigits: 6 });

export function describePower(row: Pick<RatePrices, "powerMode" | "power" | "powerMarginPerKwYear"> & { accessTariff?: string }) {
  // Gas: un término fijo por cliente y día, no por kW.
  if (row.accessTariff && energyOfTariff(row.accessTariff) === "gas") {
    if (row.powerMode === "regulated") return "Fijo: peajes y cargos (BOE)";
    if (row.powerMode === "regulated_plus") return `Fijo: peajes y cargos + ${formatPrice(row.powerMarginPerKwYear)} €/año`;
    return row.power ? `Fijo ${formatPrice(row.power.P1)} €/día` : "—";
  }
  if (row.powerMode === "regulated") return "Regulada (BOE)";
  if (row.powerMode === "regulated_plus") {
    return `BOE + ${formatPrice(row.powerMarginPerKwYear)} €/kW·año`;
  }
  return row.power ? `${formatPrice(row.power.P1)} / ${formatPrice(row.power.P2)}` : "—";
}
