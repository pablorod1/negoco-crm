import { computeCommission } from "@/comparador/engine/commission";
import { applyFee, computeCost, computeFlatCost, DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { roundEuros } from "@/comparador/engine/money";
import type { RegulatedParams } from "@/comparador/engine/regulated";
import type { CostBreakdown, TariffPrices } from "@/comparador/engine/types";
import type { CurrentTariff } from "@/comparador/extraction/current-tariff";
import { readDiscounts, shareOfYear, type DiscountPart } from "@/comparador/rates/discounts";
import { isEligible, toTariffPrices } from "@/comparador/rates/engine-prices";
import type { ActiveOfferPrice } from "@/comparador/rates/repository";
import type { CommissionRule, RateChannel } from "@/comparador/rates/types";
import type { StudySupply } from "./supply";

/** Cómo es la tarifa que paga hoy el cliente. */
export type CurrentPricing = "fixed" | "indexed" | "flat";

/**
 * Servicios de ajuste para las tarifas que los cobran aparte (TRADER
 * SERVICES, Nordy Estabilidad…). Los pone el comercial o backoffice: una media
 * para los 12 meses o un valor por mes, en €/MWh.
 */
export interface AncillarySimulation {
  averagePerMwh: number | null;
  /** De enero a diciembre; un mes sin valor toma la media de los demás. */
  monthlyPerMwh: (number | null)[] | null;
}

export interface StudyOptions {
  /** Fecha del estudio (YYYY-MM-DD): precios, peajes e impuestos de ese día. */
  date: string;
  /** Captación o renovación; null si no se sabe (vale cualquiera). */
  channel: RateChannel | null;
  /**
   * Fee de energía que pide la agencia, en €/MWh. Cada tarifa lo lleva dentro
   * de su horquilla; las que no admiten fee van sin él. null = el mínimo de
   * cada tarifa.
   */
  feeEnergyPerMwh: number | null;
  order: "savings" | "commission";
  /** Cómo es la tarifa de hoy, según quien hace el estudio; null = lo que leyó la IA. */
  currentPricing?: CurrentPricing | null;
  /** Descuentos condicionados que no se aplican, como «idPrecio:clave». */
  excludedDiscounts?: string[];
  /**
   * SSAA simulados. Sin el campo, los del tenant por defecto; null, sin
   * simular: las tarifas que los cobran aparte no se ofertan.
   */
  ancillary?: AncillarySimulation | null;
}

export interface OfferDiscountView {
  /** «idPrecio:clave», lo que se guarda en `excludedDiscounts`. */
  id: string;
  text: string;
  conditional: boolean;
  applied: boolean;
  /** Lo que resta en un año, en € y en negativo; 0 si no se aplica. */
  amount: number;
}

export interface StudyOffer {
  /** Id de la fila de precios: identifica la oferta dentro del estudio. */
  key: string;
  comercializadoraId: string;
  comercializadoraName: string;
  /** Fichero del logo de la comercializadora (ver `companyLogoUrl`). */
  comercializadoraLogo: string | null;
  rateId: string;
  productName: string;
  level: string | null;
  segment: string | null;
  channel: RateChannel | null;
  termMonths: number | null;
  powerMode: ActiveOfferPrice["price"]["powerMode"];
  /** Precios al cliente con el fee incluido (€/kW·día, €/kWh). */
  prices: TariffPrices;
  feeEnergyPerMwh: number;
  feeRange: { min: number; max: number } | null;
  cost: CostBreakdown;
  /** Ahorro anual frente a lo que paga hoy; null si no se sabe lo que paga. */
  savings: number | null;
  /** Comisión de agencia en €; null si la tarifa no tiene regla. */
  commission: number | null;
  /** Textos de los descuentos que se aplican o se enseñan, para la propuesta. */
  discounts: string[];
  /** Cada parte de descuento que el comparador sabe aplicar, con su importe. */
  discountParts: OfferDiscountView[];
  /** Descuentos que no se aplican, con el motivo. */
  informativeDiscounts: { text: string; reason: string }[];
  /** La tarifa cobra los SSAA aparte y van simulados en el coste. */
  ancillarySimulated: boolean;
  versionValidFrom: string | null;
}

export interface StudyRanking {
  /** Coste anual con lo que paga hoy; null si la factura no da todos los precios. */
  current: CostBreakdown | null;
  offers: StudyOffer[];
  /** Tarifas vigentes que no encajan con el suministro (territorio, potencia, consumo…). */
  ineligible: number;
  /** Tarifas que cobran los SSAA aparte y no se ofertan porque no hay SSAA simulados. */
  withoutAncillary: number;
  noSavings: boolean;
}

const totalKwh = (supply: StudySupply) =>
  supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;

interface AnnualExtras {
  energyDiscountRates?: readonly number[];
  powerDiscountRates?: readonly number[];
  fixedDiscounts?: readonly number[];
  ancillaryAmount?: number;
}

/** Coste de un año con unos precios, con el consumo y la potencia del estudio. */
function annualCost(
  supply: StudySupply,
  prices: TariffPrices,
  regulated: RegulatedParams,
  meterRentalPerDay: number,
  extras: AnnualExtras = {},
): CostBreakdown {
  return computeCost({
    days: DAYS_PER_YEAR,
    contractedKw: supply.contractedKw,
    energyKwh: supply.annualKwh,
    prices,
    regulated,
    ...extras,
    meterRental: { perDay: meterRentalPerDay },
  });
}

const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;

/**
 * Lo que cuestan en un año los SSAA simulados con el consumo del estudio. Con
 * un valor por mes, cada lectura del SIPS va con el de su mes (el del día
 * central de la lectura); sin lecturas guardadas, con la media de los meses.
 */
export function annualAncillaryAmount(supply: StudySupply, simulation: AncillarySimulation): number | null {
  const annual = totalKwh(supply);
  const monthly = simulation.monthlyPerMwh?.filter((value): value is number => value !== null && Number.isFinite(value)) ?? [];
  if (monthly.length > 0) {
    const mean = monthly.reduce((sum, value) => sum + value, 0) / monthly.length;
    const valueOf = (month: number) => simulation.monthlyPerMwh?.[month] ?? mean;
    const readings = supply.readings ?? [];
    const raw = readings.reduce((sum, { kwh }) => sum + kwh.P1 + kwh.P2 + kwh.P3, 0);
    if (raw <= 0) return roundEuros((annual * mean) / 1000);
    const amount = readings.reduce((sum, reading) => {
      const middle = new Date((Date.parse(reading.from) + Date.parse(reading.to)) / 2).toISOString().slice(0, 10);
      const kwh = reading.kwh.P1 + reading.kwh.P2 + reading.kwh.P3;
      return sum + (kwh * valueOf(monthOf(middle))) / 1000;
    }, 0);
    // Las lecturas cubren unos días más o menos que el año: se llevan a 365 como el consumo.
    return roundEuros(amount * (annual / raw));
  }
  if (simulation.averagePerMwh !== null && Number.isFinite(simulation.averagePerMwh)) {
    return roundEuros((annual * simulation.averagePerMwh) / 1000);
  }
  return null;
}

/** Los descuentos de una oferta como entradas del motor, y de dónde sale cada importe. */
function discountInputs(priceId: string, parts: readonly DiscountPart[], excluded: ReadonlySet<string>) {
  const energy: number[] = [];
  const power: number[] = [];
  const fixed: number[] = [];
  const positions: { part: DiscountPart; id: string; applied: boolean; lists: ("energy" | "power" | "fixed")[]; indexes: number[] }[] = [];
  for (const part of parts) {
    const id = `${priceId}:${part.key}`;
    const applied = !(part.conditional && excluded.has(id));
    const entry = { part, id, applied, lists: [] as ("energy" | "power" | "fixed")[], indexes: [] as number[] };
    positions.push(entry);
    if (!applied) continue;
    const rate = (part.value / 100) * shareOfYear(part.months);
    if (part.base === "fixed") {
      entry.lists.push("fixed");
      entry.indexes.push(fixed.push(part.value) - 1);
      continue;
    }
    if (part.base === "energy" || part.base === "energy_power") {
      entry.lists.push("energy");
      entry.indexes.push(energy.push(rate) - 1);
    }
    if (part.base === "power" || part.base === "energy_power") {
      entry.lists.push("power");
      entry.indexes.push(power.push(rate) - 1);
    }
  }
  /** El importe de cada parte en el desglose: energía, potencia y fijos van en ese orden. */
  const views = (cost: CostBreakdown): OfferDiscountView[] =>
    positions.map(({ part, id, applied, lists, indexes }) => {
      const offset = { energy: 0, power: energy.length, fixed: energy.length + power.length };
      const amount = lists.reduce((sum, list, index) => sum + (cost.energyDiscounts[offset[list] + indexes[index]] ?? 0), 0);
      return { id, text: part.text, conditional: part.conditional, applied, amount: roundEuros(amount) };
    });
  return { extras: { energyDiscountRates: energy, powerDiscountRates: power, fixedDiscounts: fixed }, views };
}

/** Fee de una tarifa: el elegido dentro de su horquilla, o el mínimo. */
function feeFor(price: ActiveOfferPrice["price"], wanted: number | null) {
  const min = price.feeEnergyMinPerMwh;
  if (min === null) return { fee: 0, range: null };
  const max = Math.max(price.feeEnergyMaxPerMwh ?? min, min);
  const fee = wanted === null ? min : Math.min(Math.max(wanted, min), max);
  return { fee, range: { min, max } };
}

/**
 * Estudio de una factura: lo que cuesta un año con lo que paga hoy y con cada
 * tarifa vigente que encaja con el suministro, con su comisión, ordenado por
 * ahorro (o por comisión).
 */
export function rankStudy({
  supply,
  current,
  offers,
  rules,
  regulated,
  options,
}: {
  supply: StudySupply;
  current: CurrentTariff | null;
  offers: readonly ActiveOfferPrice[];
  rules: readonly CommissionRule[];
  regulated: RegulatedParams;
  options: StudyOptions;
}): StudyRanking {
  const meterRentalPerDay = current?.meterRentalPerDay ?? 0;
  const currentCost = !current
    ? null
    : current.flatAnnualFee !== undefined
      ? computeFlatCost(current.flatAnnualFee, regulated, current.prices.vatExemptPerYear ?? 0)
      : annualCost(supply, current.prices, regulated, meterRentalPerDay, { energyDiscountRates: current.energyDiscountRates });
  const ancillaryAmount = options.ancillary ? annualAncillaryAmount(supply, options.ancillary) : null;
  const excluded = new Set(options.excludedDiscounts ?? []);

  const eligibility = {
    maxContractedKw: Math.max(supply.contractedKw.P1, supply.contractedKw.P2),
    annualKwh: totalKwh(supply),
    territory: supply.territory,
    supplyStart: options.date,
    channel: options.channel,
  };
  const rulesBySupplier = new Map<string, CommissionRule[]>();
  for (const rule of rules) {
    rulesBySupplier.set(rule.comercializadoraId, [...(rulesBySupplier.get(rule.comercializadoraId) ?? []), rule]);
  }

  let ineligible = 0;
  let withoutAncillary = 0;
  const priced: StudyOffer[] = [];
  for (const offer of offers) {
    const { price } = offer;
    if (!isEligible(price, eligibility)) {
      ineligible++;
      continue;
    }
    // Sin SSAA simulados, una tarifa que los cobra aparte saldría más barata de lo que es.
    if (!price.includesAncillaryServices && ancillaryAmount === null) {
      withoutAncillary++;
      continue;
    }
    const base = toTariffPrices(price, regulated);
    if (!base) continue;
    const { fee, range } = feeFor(price, options.feeEnergyPerMwh);
    const prices = applyFee(base, { energyPerMwh: fee, powerPerKwYear: 0 });
    const discounts = readDiscounts(price.discounts);
    const { extras, views } = discountInputs(price.id, discounts.parts, excluded);
    const cost = annualCost(supply, prices, regulated, meterRentalPerDay, {
      ...extras,
      ancillaryAmount: price.includesAncillaryServices ? 0 : (ancillaryAmount ?? 0),
    });
    const discountParts = views(cost);
    const commission = computeCommission(rulesBySupplier.get(offer.comercializadoraId) ?? [], {
      rateId: price.rateId,
      productName: price.rateName,
      accessTariff: "2.0TD",
      level: price.level,
      channel: options.channel,
      annualKwh: eligibility.annualKwh,
      maxContractedKw: eligibility.maxContractedKw,
      feeEnergyPerMwh: fee,
      date: options.date,
    });
    priced.push({
      key: price.id,
      comercializadoraId: offer.comercializadoraId,
      comercializadoraName: offer.comercializadoraName,
      comercializadoraLogo: offer.comercializadoraLogo ?? null,
      rateId: price.rateId,
      productName: price.rateName,
      level: price.level,
      segment: price.clientSegment,
      channel: price.channel,
      termMonths: price.termMonths,
      powerMode: price.powerMode,
      prices,
      feeEnergyPerMwh: fee,
      feeRange: range,
      cost,
      savings: currentCost ? roundEuros(currentCost.total - cost.total) : null,
      commission,
      discounts: [
        ...discountParts.filter(({ applied }) => applied).map(({ text }) => text),
        ...discounts.informative.map(({ text }) => text),
      ],
      discountParts,
      informativeDiscounts: discounts.informative,
      ancillarySimulated: !price.includesAncillaryServices,
      versionValidFrom: offer.versionValidFrom,
    });
  }

  const commissionOf = (offer: StudyOffer) => offer.commission ?? -Infinity;
  const savingsOf = (offer: StudyOffer) => offer.savings ?? -offer.cost.total;
  priced.sort((left, right) =>
    options.order === "commission"
      ? commissionOf(right) - commissionOf(left) || savingsOf(right) - savingsOf(left)
      : savingsOf(right) - savingsOf(left) || commissionOf(right) - commissionOf(left),
  );

  return {
    current: currentCost,
    offers: priced,
    ineligible,
    withoutAncillary,
    noSavings: currentCost !== null && priced.every(({ savings }) => (savings ?? 0) <= 0),
  };
}
