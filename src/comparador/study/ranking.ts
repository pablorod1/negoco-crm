import { computeCommission } from "@/comparador/engine/commission";
import { applyFee, computeCost, DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { roundEuros } from "@/comparador/engine/money";
import type { RegulatedParams } from "@/comparador/engine/regulated";
import type { CostBreakdown, TariffPrices } from "@/comparador/engine/types";
import type { CurrentTariff } from "@/comparador/extraction/current-tariff";
import { isEligible, toTariffPrices } from "@/comparador/rates/engine-prices";
import type { ActiveOfferPrice } from "@/comparador/rates/repository";
import type { CommissionRule, RateChannel } from "@/comparador/rates/types";
import type { StudySupply } from "./supply";

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
  discounts: string[];
  versionValidFrom: string | null;
}

export interface StudyRanking {
  /** Coste anual con lo que paga hoy; null si la factura no da todos los precios. */
  current: CostBreakdown | null;
  offers: StudyOffer[];
  /** Tarifas vigentes que no encajan con el suministro (territorio, potencia, consumo…). */
  ineligible: number;
  noSavings: boolean;
}

const totalKwh = (supply: StudySupply) =>
  supply.annualKwh.P1 + supply.annualKwh.P2 + supply.annualKwh.P3;

/** Coste de un año con unos precios, con el consumo y la potencia del estudio. */
function annualCost(
  supply: StudySupply,
  prices: TariffPrices,
  regulated: RegulatedParams,
  meterRentalPerDay: number,
  energyDiscountRates: readonly number[] = [],
): CostBreakdown {
  return computeCost({
    days: DAYS_PER_YEAR,
    contractedKw: supply.contractedKw,
    energyKwh: supply.annualKwh,
    prices,
    regulated,
    energyDiscountRates,
    meterRental: { perDay: meterRentalPerDay },
  });
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
  const currentCost = current
    ? annualCost(supply, current.prices, regulated, meterRentalPerDay, current.energyDiscountRates)
    : null;

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
  const priced: StudyOffer[] = [];
  for (const offer of offers) {
    const { price } = offer;
    if (!isEligible(price, eligibility)) {
      ineligible++;
      continue;
    }
    const base = toTariffPrices(price, regulated);
    if (!base) continue;
    const { fee, range } = feeFor(price, options.feeEnergyPerMwh);
    const prices = applyFee(base, { energyPerMwh: fee, powerPerKwYear: 0 });
    const cost = annualCost(supply, prices, regulated, meterRentalPerDay);
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
      discounts: price.discounts.map(({ text }) => text),
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
    noSavings: currentCost !== null && priced.every(({ savings }) => (savings ?? 0) <= 0),
  };
}
