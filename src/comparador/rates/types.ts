/** Tipos del catálogo de tarifas, las versiones de precios y las ingestas. */

export type RatePricing = "fixed" | "indexed" | "flat" | "other";
export type Territory = "peninsula" | "baleares" | "canarias" | "ceuta_melilla";
export type RateChannel = "acquisition" | "renewal";
/** Potencia propia, la regulada («BOE») o la regulada más un margen. */
export type PowerMode = "fixed" | "regulated" | "regulated_plus";

export const TERRITORIES: readonly Territory[] = [
  "peninsula",
  "baleares",
  "canarias",
  "ceuta_melilla",
];

export interface RateDiscount {
  kind: "energy_percent" | "power_percent" | "fixed_amount" | "other";
  value: number | null;
  months: number | null;
  /** Depende de algo que el comparador no sabe (servicios, franja elegida…). */
  conditional: boolean;
  text: string;
}

/**
 * Condiciones de una fila de precios. `null` significa «sin restricción». Dos
 * filas del mismo producto con las mismas condiciones son la misma fila.
 */
export interface RateConditions {
  level: string | null;
  territory: Territory;
  channel: RateChannel | null;
  clientSegment: string | null;
  minPowerKw: number | null;
  maxPowerKw: number | null;
  minAnnualKwh: number | null;
  maxAnnualKwh: number | null;
  /** YYYY-MM-DD. */
  supplyStartFrom: string | null;
  supplyStartTo: string | null;
  termMonths: number | null;
}

/** Precios de una fila, ya en las unidades del motor. */
export interface RatePrices {
  accessTariff: string;
  pricing: RatePricing;
  powerMode: PowerMode;
  powerMarginPerKwYear: number | null;
  /** €/kW·día. Con potencia regulada, `null`. */
  power: { P1: number; P2: number } | null;
  /** €/kWh. Un producto de precio único lleva el mismo valor en los tres. */
  energy: { P1: number; P2: number; P3: number } | null;
  includesAncillaryServices: boolean;
  feeEnergyMinPerMwh: number | null;
  feeEnergyMaxPerMwh: number | null;
  feePowerAllowed: boolean;
  discounts: RateDiscount[];
}

/** Fila propuesta por una ingesta, antes de casarla con una tarifa del tenant. */
export interface ProposedRate extends RateConditions, RatePrices {
  productName: string;
  productKey: string;
  /** La potencia no aparece en el documento (actualización parcial o anexo incompleto). */
  powerStated: boolean;
  sourceExcerpt: string;
  /** Valores tal como venían en el documento, con su unidad. */
  sourceValues: Record<string, number | string | null>;
}

/** Fila guardada en `comercializadora_rate_prices`. */
export interface StoredRatePrice extends RateConditions, RatePrices {
  id: string;
  versionId: string;
  rateId: string;
  rateName: string;
  catalogRateId: string | null;
  sourceExcerpt: string | null;
  sourceLocation: string | null;
}

export type VersionStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "superseded"
  | "discarded";

export interface RateVersion {
  id: string;
  comercializadoraId: string;
  status: VersionStatus;
  validFrom: string | null;
  validTo: string | null;
  source: "document" | "api" | "manual" | "copy";
  ingestId: string | null;
  basedOnVersionId: string | null;
  notes: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export type IngestStatus =
  | "received"
  | "processing"
  | "needs_review"
  | "ready"
  | "approved"
  | "rejected"
  | "failed"
  | "out_of_scope";

export interface IngestFile {
  path: string;
  name: string;
  mime: string;
  size: number;
}

export interface CommissionRuleInput {
  rateId: string | null;
  accessTariff: string | null;
  level: string | null;
  channel: RateChannel | null;
  minAnnualKwh: number | null;
  maxAnnualKwh: number | null;
  ruleType: "fixed" | "per_mwh" | "fee_share";
  /** Con fee_share: porcentaje del fee de energía (por defecto) o del de potencia. */
  feeBase: "energy" | "power";
  amount: number;
}

export interface CommissionRule extends CommissionRuleInput {
  id: string;
  comercializadoraId: string;
  validFrom: string;
  validTo: string | null;
}
