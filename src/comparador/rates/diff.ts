import { energyOfTariff } from "@/comparador/gas/regulated";
import { conditionsKey } from "./keys";
import type { RateMatch } from "./match";
import { productKeyOf } from "./names";
import { rowKey, type RateIssue } from "./validate";
import type {
  ProposedRate,
  RateConditions,
  RatePrices,
  StoredRatePrice,
} from "./types";

/** Variación a partir de la cual un precio se marca para revisar. */
export const BIG_CHANGE = 0.2;

export interface ResolvedRow extends ProposedRate {
  match: RateMatch;
}

export interface FieldChange {
  field: string;
  from: number | null;
  to: number | null;
  /** Variación relativa (0,1 = +10 %). `null` si no hay valor anterior. */
  relative: number | null;
}

export type DiffKind = "added" | "changed" | "unchanged" | "removed" | "carried";

export interface DiffEntry {
  kind: DiffKind;
  key: string;
  /** Clave de la fila propuesta (producto y condiciones); null en filas activas no tocadas. */
  rowKey: string | null;
  productName: string;
  conditions: RateConditions & { accessTariff: string };
  proposed: ResolvedRow | null;
  active: StoredRatePrice | null;
  changes: FieldChange[];
}

/** Fila lista para guardar en la versión nueva. */
export interface VersionRow extends RateConditions, RatePrices {
  rateId: string | null;
  catalogRateId: string | null;
  productName: string;
  productKey: string;
  sourceExcerpt: string | null;
  sourceValues: Record<string, number | string | null> | null;
}

function proposedKey(row: ResolvedRow): string {
  return `${row.match.rateId ?? `new:${row.productKey}`}|${conditionsKey(row)}`;
}

function activeKey(row: StoredRatePrice): string {
  return `${row.rateId}|${conditionsKey(row)}`;
}

function conditionsOf(
  row: RateConditions & { accessTariff: string },
): RateConditions & { accessTariff: string } {
  return {
    accessTariff: row.accessTariff,
    level: row.level,
    territory: row.territory,
    channel: row.channel,
    clientSegment: row.clientSegment,
    minPowerKw: row.minPowerKw,
    maxPowerKw: row.maxPowerKw,
    minAnnualKwh: row.minAnnualKwh,
    maxAnnualKwh: row.maxAnnualKwh,
    supplyStartFrom: row.supplyStartFrom,
    supplyStartTo: row.supplyStartTo,
    termMonths: row.termMonths,
  };
}

function priceFields(row: RatePrices): Record<string, number | null> {
  return {
    "energy.P1": row.energy?.P1 ?? null,
    "energy.P2": row.energy?.P2 ?? null,
    "energy.P3": row.energy?.P3 ?? null,
    "power.P1": row.power?.P1 ?? null,
    "power.P2": row.power?.P2 ?? null,
    powerMargin: row.powerMarginPerKwYear,
    feeMin: row.feeEnergyMinPerMwh,
    feeMax: row.feeEnergyMaxPerMwh,
  };
}

function compare(before: RatePrices, after: RatePrices): FieldChange[] {
  const from = priceFields(before);
  const to = priceFields(after);
  const changes: FieldChange[] = [];
  for (const field of Object.keys(to)) {
    if (from[field] === to[field]) continue;
    const previous = from[field];
    const next = to[field];
    changes.push({
      field,
      from: previous,
      to: next,
      relative:
        previous && next !== null ? (next - previous) / previous : null,
    });
  }
  if (before.pricing !== after.pricing) {
    changes.push({ field: `pricing:${after.pricing}`, from: null, to: null, relative: null });
  }
  if (before.powerMode !== after.powerMode) {
    changes.push({ field: `powerMode:${after.powerMode}`, from: null, to: null, relative: null });
  }
  return changes;
}

/**
 * Fila propuesta completada con la versión activa: si el documento no da la
 * potencia (una actualización que solo cambia la energía), se conserva la que
 * había. Y si la tarifa era de precio base (admitía el fee de la agencia), lo
 * sigue siendo aunque el anexo nuevo no lo diga: la nota que lo explica suele
 * estar fuera de las tablas («a estos precios base hay que incluirles el COE»)
 * y una plantilla guardada no la lee.
 */
function withActive(
  row: ResolvedRow,
  active: StoredRatePrice | null,
  baseOfProduct: StoredRatePrice | null,
): ResolvedRow {
  const powered: ResolvedRow =
    row.powerStated || !active
      ? row
      : { ...row, powerMode: active.powerMode, powerMarginPerKwYear: active.powerMarginPerKwYear, power: active.power };
  const fee = active?.feeEnergyMinPerMwh != null ? active : baseOfProduct;
  if (row.feeDecided || row.feeEnergyMinPerMwh !== null || !fee) return powered;
  return { ...powered, feeEnergyMinPerMwh: fee.feeEnergyMinPerMwh, feeEnergyMaxPerMwh: fee.feeEnergyMaxPerMwh };
}

/**
 * Compara las filas propuestas con la versión activa. En una actualización
 * parcial, las filas activas que el documento no menciona se conservan; en una
 * completa, se marcan como retiradas. Un anexo de luz no retira las tarifas
 * de gas ni al revés: las del otro suministro siempre se conservan.
 */
export function buildDiff(
  rows: readonly ResolvedRow[],
  active: readonly StoredRatePrice[],
  { partialUpdate }: { partialUpdate: boolean },
): { entries: DiffEntry[]; versionRows: VersionRow[]; issues: RateIssue[] } {
  const activeByKey = new Map(active.map((row) => [activeKey(row), row]));
  // Una fila de cada producto que admite fee: de ella hereda una fila nueva del mismo producto.
  const baseByRate = new Map(active.filter((row) => row.feeEnergyMinPerMwh !== null).map((row) => [row.rateId, row]));
  const used = new Set<string>();
  const energies = new Set(rows.map((row) => energyOfTariff(row.accessTariff)));
  const entries: DiffEntry[] = [];
  const versionRows: VersionRow[] = [];
  const issues: RateIssue[] = [];

  for (const row of rows) {
    const key = proposedKey(row);
    const previous = activeByKey.get(key) ?? null;
    if (previous) used.add(key);
    const effective = withActive(row, previous, row.match.rateId ? (baseByRate.get(row.match.rateId) ?? null) : null);
    const prices: RatePrices = effective;

    if (!row.powerStated && !previous && row.powerMode === "fixed") {
      issues.push({
        severity: "blocking",
        code: "missing_power",
        message: `${row.productName}: el documento no da la potencia y no hay versión activa de la que tomarla.`,
        rowKey: rowKey(row),
      });
    }

    const changes = previous ? compare(previous, prices) : [];
    entries.push({
      kind: previous ? (changes.length ? "changed" : "unchanged") : "added",
      key,
      rowKey: rowKey(row),
      productName: row.match.productName,
      conditions: conditionsOf(row),
      proposed: effective,
      active: previous,
      changes,
    });

    for (const change of changes) {
      if (change.relative !== null && Math.abs(change.relative) > BIG_CHANGE) {
        issues.push({
          severity: "warning",
          code: "big_change",
          rowKey: rowKey(row),
          message: `${row.match.productName}: ${change.field} cambia un ${Math.round(change.relative * 100)} % (${change.from} → ${change.to}).`,
        });
      }
    }

    versionRows.push({
      ...conditionsOf(row),
      ...prices,
      rateId: row.match.rateId,
      catalogRateId: row.match.catalogRateId,
      productName: row.match.productName,
      productKey: row.productKey,
      sourceExcerpt: row.sourceExcerpt,
      sourceValues: row.sourceValues,
    });
  }

  for (const row of active) {
    const key = activeKey(row);
    if (used.has(key)) continue;
    const carried = partialUpdate || !energies.has(energyOfTariff(row.accessTariff));
    entries.push({
      kind: carried ? "carried" : "removed",
      key,
      rowKey: null,
      productName: row.rateName,
      conditions: conditionsOf(row),
      proposed: null,
      active: row,
      changes: [],
    });
    if (!carried) {
      issues.push({
        severity: "warning",
        code: "missing_rate",
        message: `${row.rateName} (${row.level ?? "sin nivel"}) estaba en la versión activa y no aparece en el documento: dejará de ofrecerse.`,
      });
      continue;
    }

    versionRows.push({
      ...conditionsOf(row),
      pricing: row.pricing,
      powerMode: row.powerMode,
      powerMarginPerKwYear: row.powerMarginPerKwYear,
      power: row.power,
      energy: row.energy,
      includesAncillaryServices: row.includesAncillaryServices,
      feeEnergyMinPerMwh: row.feeEnergyMinPerMwh,
      feeEnergyMaxPerMwh: row.feeEnergyMaxPerMwh,
      feePowerAllowed: row.feePowerAllowed,
      discounts: row.discounts,
      rateId: row.rateId,
      catalogRateId: row.catalogRateId,
      productName: row.rateName,
      productKey: productKeyOf(row.rateName),
      sourceExcerpt: row.sourceExcerpt,
      sourceValues: null,
    });
  }

  return { entries, versionRows, issues };
}
