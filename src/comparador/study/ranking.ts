import { computeCommission } from "@/comparador/engine/commission";
import { applyFee, computeCost, computeFlatCost, DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { roundEuros } from "@/comparador/engine/money";
import type { RegulatedParams } from "@/comparador/engine/regulated";
import type { CostBreakdown, TariffPrices } from "@/comparador/engine/types";
import type { CurrentTariff } from "@/comparador/extraction/current-tariff";
import { computeGasCost, gasOfferPrices } from "@/comparador/gas/cost";
import type { GasCurrentTariff } from "@/comparador/gas/invoice";
import { gasTollsOn, type GasRegulatedParams } from "@/comparador/gas/regulated";
import { readDiscounts, shareOfYear, type DiscountPart } from "@/comparador/rates/discounts";
import { isEligible, toTariffPrices } from "@/comparador/rates/engine-prices";
import { historyForRate, type IndexHistoryRow } from "@/comparador/rates/index-history";
import type { ActiveOfferPrice } from "@/comparador/rates/repository";
import type { CommissionRule, RateChannel } from "@/comparador/rates/types";
import { historyEnergyPrices } from "./indexed";
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

/** Particular, autónomo o empresa: decide qué tarifas se le ofertan. */
export type CustomerType = "particular" | "autonomo" | "empresa";

/** Para quién es una tarifa, por su segmento en el anexo o por su nombre; null si vale para todos. */
export function rateAudience(segment: string | null, productName: string): "hogar" | "negocio" | null {
  const text = `${segment ?? ""} ${productName}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(pymes?|negocios?|empresas?|profesional(es)?|comercios?|business|autonomos?)\b/.test(text)) return "negocio";
  if (/\b(hogar|domestic[oa]s?|residencial(es)?|particular(es)?|casa|vivienda)\b/.test(text)) return "hogar";
  return null;
}

/** Particular: hogar; empresa: negocio; autónomo: los dos. Las tarifas sin segmento, para todos. */
function audienceFits(audience: "hogar" | "negocio" | null, customer: CustomerType | null | undefined): boolean {
  if (!audience || !customer || customer === "autonomo") return true;
  return customer === "particular" ? audience === "hogar" : audience === "negocio";
}

export interface StudyOptions {
  /** Fecha del estudio (YYYY-MM-DD): precios, peajes e impuestos de ese día. */
  date: string;
  /** Tipo de cliente; sin él se ofertan todas las tarifas. */
  customerType?: CustomerType | null;
  /** Captación o renovación; null si no se sabe (vale cualquiera). */
  channel: RateChannel | null;
  /**
   * Fee de energía que pide la agencia, en €/MWh. Cada tarifa lo lleva dentro
   * de su horquilla; las que no admiten fee van sin él. null = el mínimo de
   * cada tarifa.
   */
  feeEnergyPerMwh: number | null;
  /**
   * Fee de potencia en €/kW·año. Solo en las tarifas con precio base que lo
   * admiten en la potencia; las demás van sin él. null o 0 = sin fee.
   */
  feePowerPerKwYear?: number | null;
  order: "savings" | "commission";
  /** Cómo es la tarifa de hoy, según quien hace el estudio; null = lo que leyó la IA. */
  currentPricing?: CurrentPricing | null;
  /** Descuentos condicionados que no se aplican, como «idPrecio:clave». */
  excludedDiscounts?: string[];
  /**
   * SSAA aplicados. Sin el campo o null, sin aplicar: las tarifas que los
   * cobran aparte no se ofertan.
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
  /**
   * Precio fijo o indexado. Falta en propuestas anteriores al 2026-10-15, que
   * eran todas de precio fijo.
   */
  pricing?: "fixed" | "indexed";
  /**
   * Indexada: los meses del histórico con los que se ha calculado la energía
   * (YYYY-MM), los de los 12 meses de consumo del SIPS.
   */
  indexHistory?: { from: string; to: string } | null;
  /** Precios al cliente con el fee incluido (€/kW·día, €/kWh). Indexada: la media del año. */
  prices: TariffPrices;
  feeEnergyPerMwh: number;
  feeRange: { min: number; max: number } | null;
  /** Fee de potencia aplicado (€/kW·año); 0 si la tarifa no lo admite. */
  feePowerPerKwYear: number;
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
  /**
   * La tarifa cobra los SSAA aparte y el estudio no los aplica: se oferta,
   * pero su coste no los lleva y hay que avisar de que hacen falta.
   */
  needsAncillary: boolean;
  versionValidFrom: string | null;
}

export interface StudyRanking {
  /** Coste anual con lo que paga hoy; null si la factura no da todos los precios. */
  current: CostBreakdown | null;
  offers: StudyOffer[];
  /** Tarifas vigentes que no encajan con el suministro (territorio, potencia, consumo…). */
  ineligible: number;
  /** Tarifas que cobran los SSAA aparte y se ofertan sin ellos (no se han aplicado). */
  withoutAncillary: number;
  /** Tarifas de otro tipo de cliente (hogar para una empresa o al revés). */
  otherCustomerType: number;
  /**
   * Indexadas que no se ofertan porque su histórico no cubre los 12 meses de
   * consumo (o el estudio no guarda las lecturas del SIPS: hay que reanalizarlo).
   */
  withoutHistory: { comercializadoraName: string; productName: string; missing: string[] }[];
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
  indexHistory = [],
  gasRegulated,
}: {
  supply: StudySupply;
  current: CurrentTariff | null;
  offers: readonly ActiveOfferPrice[];
  rules: readonly CommissionRule[];
  regulated: RegulatedParams;
  options: StudyOptions;
  /** Histórico del indexado de las comercializadoras, para las tarifas indexadas. */
  indexHistory?: readonly IndexHistoryRow[];
  /** Gas: impuesto de hidrocarburos e IVA. Hace falta si el suministro es de gas. */
  gasRegulated?: GasRegulatedParams;
}): StudyRanking {
  const gas = supply.energy === "gas" ? supply.gas! : null;
  if (gas && !gasRegulated) throw new Error("rankStudy: gas supply without gas regulated params");
  /** Coste de un año: con el desglose de una factura de gas o de una de luz. */
  const yearCost = (prices: TariffPrices, meterRentalPerDay: number, extras: AnnualExtras = {}): CostBreakdown =>
    gas
      ? computeGasCost({
          days: DAYS_PER_YEAR,
          kwh: totalKwh(supply),
          prices,
          regulated: gasRegulated!,
          energyDiscountRates: extras.energyDiscountRates,
          fixedTermDiscountRates: extras.powerDiscountRates,
          fixedDiscounts: extras.fixedDiscounts,
          meterRental: { perDay: meterRentalPerDay },
        })
      : annualCost(supply, prices, regulated, meterRentalPerDay, extras);

  const meterRentalPerDay = current?.meterRentalPerDay ?? 0;
  const gasCurrent = current as Partial<GasCurrentTariff> | null;
  const currentCost = !current
    ? null
    : current.flatAnnualFee !== undefined
      ? computeFlatCost(current.flatAnnualFee, gasRegulated ?? regulated, current.prices.vatExemptPerYear ?? 0)
      : yearCost(current.prices, meterRentalPerDay, {
          energyDiscountRates: current.energyDiscountRates,
          powerDiscountRates: gasCurrent?.fixedTermDiscountRates,
          fixedDiscounts: gasCurrent?.fixedDiscountsPerYear,
        });
  // Los servicios de ajuste son de la luz.
  const ancillaryAmount = options.ancillary && !gas ? annualAncillaryAmount(supply, options.ancillary) : null;
  const excluded = new Set(options.excludedDiscounts ?? []);

  const eligibility = {
    maxContractedKw: Math.max(supply.contractedKw.P1, supply.contractedKw.P2),
    // Con el consumo estimado, el real del SIPS (si lo hay) decide la
    // comisión y las tarifas por tramo de consumo.
    annualKwh: supply.referenceAnnualKwh ?? totalKwh(supply),
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
  let otherCustomerType = 0;
  const withoutHistory: StudyRanking["withoutHistory"] = [];
  const priced: StudyOffer[] = [];
  for (const offer of offers) {
    const { price } = offer;
    // Gas: solo las tarifas fijas de su peaje. Beenergy solo vende gas fijo
    // (el indexado, más adelante).
    if (!isEligible(price, eligibility) || (gas && (price.accessTariff !== gas.accessTariff || price.pricing === "indexed"))) {
      ineligible++;
      continue;
    }
    if (!audienceFits(rateAudience(price.clientSegment, price.rateName), options.customerType)) {
      otherCustomerType++;
      continue;
    }
    // Sin SSAA aplicados, una tarifa que los cobra aparte sale más barata de lo
    // que es: se oferta igual, marcada, para que se apliquen.
    // Indexada: la energía es la del histórico en los meses de su consumo. Sin
    // histórico de todos esos meses no hay precio real y no se oferta.
    let indexed: { from: string; to: string } | null = null;
    let energy = price.energy;
    if (price.pricing === "indexed") {
      const fromHistory = historyEnergyPrices(
        historyForRate(indexHistory, offer.comercializadoraId, price.rateId),
        supply.readings ?? [],
      );
      if (!fromHistory || "missing" in fromHistory) {
        withoutHistory.push({
          comercializadoraName: offer.comercializadoraName,
          productName: price.rateName,
          missing: fromHistory ? fromHistory.missing : [],
        });
        continue;
      }
      energy = fromHistory.energy;
      indexed = { from: fromHistory.from, to: fromHistory.to };
    }
    // Una indexada de luz cobra los SSAA aparte, sobre el histórico (Beenergy,
    // 15-10-2026), diga lo que diga su anexo.
    const ancillaryIncluded = gas !== null || (price.includesAncillaryServices && price.pricing !== "indexed");
    const needsAncillary = !ancillaryIncluded && ancillaryAmount === null;
    if (needsAncillary) withoutAncillary++;
    // Gas: con los peajes y cargos que la tarifa no lleva.
    const base = gas
      ? gasOfferPrices({ ...price, energy }, gasTollsOn(options.date, gas.accessTariff))
      : toTariffPrices({ ...price, energy }, regulated);
    if (!base) continue;
    const { fee, range } = feeFor(price, options.feeEnergyPerMwh);
    // Gas: el término fijo es por cliente, no por kW; no lleva fee.
    const powerFee = price.feePowerAllowed && !gas ? Math.max(0, options.feePowerPerKwYear ?? 0) : 0;
    const prices = applyFee(base, { energyPerMwh: fee, powerPerKwYear: powerFee });
    const discounts = readDiscounts(price.discounts);
    const { extras, views } = discountInputs(price.id, discounts.parts, excluded);
    const cost = yearCost(prices, meterRentalPerDay, {
      ...extras,
      ancillaryAmount: ancillaryIncluded ? 0 : (ancillaryAmount ?? 0),
    });
    const discountParts = views(cost);
    const commission = computeCommission(rulesBySupplier.get(offer.comercializadoraId) ?? [], {
      rateId: price.rateId,
      productName: price.rateName,
      accessTariff: gas ? price.accessTariff : "2.0TD",
      energy: gas ? "gas" : "electricity",
      pricing: price.pricing === "indexed" ? "indexed" : "fixed",
      level: price.level,
      channel: options.channel,
      annualKwh: eligibility.annualKwh,
      maxContractedKw: eligibility.maxContractedKw,
      feeEnergyPerMwh: fee,
      feePowerPerKwYear: powerFee,
      contractedKwTotal: supply.contractedKw.P1 + supply.contractedKw.P2,
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
      pricing: price.pricing === "indexed" ? "indexed" : "fixed",
      indexHistory: indexed,
      prices,
      feeEnergyPerMwh: fee,
      feeRange: range,
      feePowerPerKwYear: powerFee,
      cost,
      savings: currentCost ? roundEuros(currentCost.total - cost.total) : null,
      commission,
      discounts: [
        ...discountParts.filter(({ applied }) => applied).map(({ text }) => text),
        ...discounts.informative.map(({ text }) => text),
      ],
      discountParts,
      informativeDiscounts: discounts.informative,
      ancillarySimulated: !ancillaryIncluded && ancillaryAmount !== null,
      needsAncillary,
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
    otherCustomerType,
    withoutHistory,
    noSavings: currentCost !== null && priced.every(({ savings }) => (savings ?? 0) <= 0),
  };
}
