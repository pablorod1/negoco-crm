import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { roundEuros, sumEuros } from "@/comparador/engine/money";
import type { CostBreakdown, TariffPrices } from "@/comparador/engine/types";
import type { RatePrices } from "@/comparador/rates/types";
import type { GasRegulatedParams, GasTolls } from "./regulated";

/**
 * Precios de una tarifa de gas en la forma del motor de luz, para compartir
 * fee, descuentos, ofertas y propuestas: el término fijo en `power.P1`
 * (€/día, no por kW) y el variable en los tres periodos de `energy` (€/kWh).
 */
export function gasTariffPrices(fixedPerDay: number, energyPerKwh: number, extras: Omit<TariffPrices, "power" | "energy"> = {}): TariffPrices {
  return {
    ...extras,
    power: { P1: fixedPerDay, P2: 0 },
    energy: { P1: energyPerKwh, P2: energyPerKwh, P3: energyPerKwh },
  };
}

export interface GasCostInput {
  days: number;
  kwh: number;
  prices: TariffPrices;
  regulated: GasRegulatedParams;
  /** Descuentos sobre el término variable, en tanto por uno. */
  energyDiscountRates?: readonly number[];
  /** Descuentos sobre el término fijo, en tanto por uno. */
  fixedTermDiscountRates?: readonly number[];
  /** Descuentos de importe fijo en el periodo, en € y en positivo. */
  fixedDiscounts?: readonly number[];
  meterRental: { perDay: number; days?: number };
  /** Servicios del periodo en €; si falta, se prorratean los anuales. */
  servicesAmount?: number;
  /** Conceptos sin IVA del periodo; si falta, se prorratean los anuales. */
  vatExemptAmount?: number;
}

/**
 * Coste de un periodo con el desglose de una factura de gas: término fijo
 * (días × €/día), término variable (kWh × €/kWh), descuentos, impuesto sobre
 * hidrocarburos (kWh × €/kWh, sin descuentos), alquiler del contador y
 * servicios; todo con IVA. Cada línea se redondea a céntimos.
 */
export function computeGasCost(input: GasCostInput): CostBreakdown {
  const { days, kwh, prices, regulated } = input;
  const fixedTerm = roundEuros(days * prices.power.P1);
  const variable = roundEuros(kwh * prices.energy.P1);

  const discounts = [
    ...(input.energyDiscountRates ?? []).map((rate) => roundEuros(-variable * rate)),
    ...(input.fixedTermDiscountRates ?? []).map((rate) => roundEuros(-fixedTerm * rate)),
    ...(input.fixedDiscounts ?? []).map((amount) => roundEuros(-Math.abs(amount))),
  ];
  const otherGas = roundEuros(((prices.otherElectricityPerYear ?? 0) * days) / DAYS_PER_YEAR);
  const gasSubtotal = sumEuros([fixedTerm, variable, ...discounts, otherGas]);
  const hydrocarbonTax = roundEuros(kwh * regulated.hydrocarbonTaxPerKwh);
  const meterRental = roundEuros((input.meterRental.days ?? days) * input.meterRental.perDay);
  const services = roundEuros(input.servicesAmount ?? ((prices.servicesPerYear ?? 0) * days) / DAYS_PER_YEAR);
  const taxableBase = sumEuros([gasSubtotal, hydrocarbonTax, meterRental, services]);
  const vat = roundEuros(taxableBase * regulated.vatRate);
  const vatExempt = roundEuros(input.vatExemptAmount ?? ((prices.vatExemptPerYear ?? 0) * days) / DAYS_PER_YEAR);

  return {
    kind: "gas",
    days,
    power: { P1: fixedTerm, P2: 0, total: fixedTerm },
    energy: { P1: variable, P2: 0, P3: 0, total: variable },
    energyDiscounts: discounts,
    otherElectricity: otherGas,
    socialBonus: 0,
    electricitySubtotal: gasSubtotal,
    electricityTax: hydrocarbonTax,
    meterRental,
    services,
    taxableBase,
    vat,
    vatExempt,
    total: sumEuros([taxableBase, vat, vatExempt]),
  };
}

/**
 * Precios de una fila de gas con los peajes que no lleva. El término fijo
 * puede ser propio (powerMode fixed, €/día en power.P1), los peajes y cargos
 * a coste (regulated) o los peajes y cargos más un margen al año
 * (regulated_plus, en powerMarginPerKwYear). En gas, `includesAncillaryServices`
 * dice si el variable ya lleva el peaje (el gas no tiene servicios de ajuste);
 * si no, se le suma. null si faltan precios o los peajes de la fecha.
 */
export function gasOfferPrices(
  row: Pick<RatePrices, "powerMode" | "powerMarginPerKwYear" | "power" | "energy" | "includesAncillaryServices">,
  tolls: GasTolls | null,
): TariffPrices | null {
  if (!row.energy) return null;
  if ((row.powerMode !== "fixed" || !row.includesAncillaryServices) && !tolls) return null;
  const fixedPerDay =
    row.powerMode === "fixed"
      ? (row.power?.P1 ?? null)
      : (tolls!.fixedPerYear + (row.powerMode === "regulated_plus" ? (row.powerMarginPerKwYear ?? 0) : 0)) / DAYS_PER_YEAR;
  if (fixedPerDay === null) return null;
  return gasTariffPrices(fixedPerDay, row.energy.P1 + (row.includesAncillaryServices ? 0 : tolls!.energyPerKwh));
}
