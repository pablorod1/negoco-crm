import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import type { TariffPrices } from "@/comparador/engine/types";
import type { InvoiceExtraction } from "./invoice-schema";

export interface CurrentTariff {
  prices: TariffPrices;
  /** Descuentos sobre la energía en tanto por uno, para repetirlos al año. */
  energyDiscountRates: number[];
  meterRentalPerDay: number;
  /** Tarifa plana: la cuota de 12 meses, sin IVA. Lleva dentro todo lo demás. */
  flatAnnualFee?: number;
}

/** Días de un mes medio, para contar las cuotas de una factura de tarifa plana. */
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

/**
 * Lo que paga hoy con una tarifa plana: la cuota mensual por 12 (criterio de
 * Beenergy). La cuota es la base imponible de la factura (Naturgy: «Total
 * electricidad 29,00 €», sin impuesto eléctrico aparte); una factura de 31
 * días es una cuota, no 31/30 de cuota.
 */
export function flatTariffFromInvoice(invoice: InvoiceExtraction): CurrentTariff | null {
  const fee =
    invoice.vat?.base ??
    invoice.taxableBase ??
    invoice.otherTaxableLines.reduce((sum, { amount }) => sum + amount, 0);
  const days = invoice.billingPeriod?.days ?? 0;
  if (fee <= 0 || days <= 0) return null;
  const months = Math.max(1, Math.round(days / DAYS_PER_MONTH));
  const vatExempt = invoice.vatExemptLines.reduce((sum, { amount }) => sum + amount, 0);
  return {
    prices: {
      power: { P1: 0, P2: 0 },
      energy: { P1: 0, P2: 0, P3: 0 },
      vatExemptPerYear: (vatExempt / months) * 12,
    },
    energyDiscountRates: [],
    meterRentalPerDay: 0,
    flatAnnualFee: (fee / months) * 12,
  };
}

type PowerPeriod = "P1" | "P2";
type EnergyPeriod = "P1" | "P2" | "P3";

export interface PeriodPrices {
  power: Record<PowerPeriod, number | null>;
  energy: Record<EnergyPeriod, number | null>;
}

/**
 * Precio de potencia de un periodo. Las líneas con los mismos kW y días son
 * conceptos que se suman (peaje, cargo, margen); los tramos de fechas
 * distintos se promedian según kW × días.
 */
function powerPrice(
  lines: InvoiceExtraction["powerLines"],
  period: PowerPeriod,
): number | null {
  const tranches = new Map<string, { weight: number; price: number }>();
  for (const line of lines.filter((item) => item.period === period)) {
    const key = `${line.kw}|${line.days}`;
    const tranche = tranches.get(key) ?? { weight: line.kw * line.days, price: 0 };
    tranche.price += line.pricePerKwDay;
    tranches.set(key, tranche);
  }
  const totalWeight = [...tranches.values()].reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight <= 0) return null;
  return (
    [...tranches.values()].reduce((sum, t) => sum + t.weight * t.price, 0) /
    totalWeight
  );
}

/**
 * Precio efectivo de energía de cada periodo. Las líneas de un periodo pueden
 * ser conceptos que cubren todo su consumo (energía, peajes, cargos: se suman)
 * o tramos de fechas que lo reparten (se promedian). El número de conceptos
 * sale de comparar los kWh de las líneas con el consumo, redondeado, para que
 * un consumo por periodo redondeado no desvíe el precio. Las líneas de precio
 * único (ALL) se suman a todos los periodos. Una factura sin consumo (0 kWh)
 * imprime igual el €/kWh: se toma ese, sumando sus conceptos.
 */
function energyPrices(invoice: InvoiceExtraction): PeriodPrices["energy"] {
  const consumption = invoice.consumptionKwh;
  const totalConsumption = (["P1", "P2", "P3"] as const).reduce(
    (sum, period) => sum + (consumption[period] ?? 0),
    0,
  );

  const priceOfLines = (
    period: EnergyPeriod | "ALL",
    consumed: number | null,
  ): number | null => {
    const lines = invoice.energyLines.filter((line) => line.period === period);
    const kwh = lines.reduce((sum, line) => sum + line.kwh, 0);
    if (kwh <= 0) {
      // Sin kWh no hay importes que pesar: los mismos (cero) kWh en todas, como conceptos.
      const printed = lines.filter((line) => line.pricePerKwh > 0);
      return printed.length > 0 ? printed.reduce((sum, line) => sum + line.pricePerKwh, 0) : null;
    }
    const value = lines.reduce((sum, line) => sum + line.kwh * line.pricePerKwh, 0);
    const concepts =
      consumed && consumed > 0 ? Math.max(1, Math.round(kwh / consumed)) : 1;
    return (value * concepts) / kwh;
  };

  const singlePrice = priceOfLines("ALL", totalConsumption || null);
  const priceOf = (period: EnergyPeriod): number | null => {
    const own = priceOfLines(period, consumption[period]);
    if (own === null && singlePrice === null) return null;
    return (own ?? 0) + (singlePrice ?? 0);
  };

  return { P1: priceOf("P1"), P2: priceOf("P2"), P3: priceOf("P3") };
}

/** Alquiler por día: importe entre sus días, o entre los del periodo. */
function meterRentalPerDay(invoice: InvoiceExtraction): number {
  const rental = invoice.meterRental;
  if (!rental) return 0;
  const days = rental.days ?? invoice.billingPeriod?.days ?? null;
  return days && days > 0 ? rental.amount / days : 0;
}

/**
 * Meses que dura un descuento según su descripción («durante 3 meses», «6
 * primeros meses», «1 año»); null si no lo dice.
 */
export function discountMonths(description: string): number | null {
  const text = description.toLowerCase();
  const months = /(\d{1,2})\s*(?:primeros\s+)?mes(?:es)?\b/.exec(text);
  if (months) return Number(months[1]);
  const years = /(\d)\s*años?\b/.exec(text);
  return years ? Number(years[1]) * 12 : null;
}

/**
 * Parte del año que cuenta un descuento: los temporales, en proporción a sus
 * meses; los demás, todo el año (criterio de Beenergy, 2026-10-13).
 */
function shareOfYear(description: string, amount: number): number {
  if (amount >= 0) return 1;
  const months = discountMonths(description);
  return months === null || months <= 0 ? 1 : Math.min(months, 12) / 12;
}

/** Precio de cada periodo leído de la factura; null si no se puede saber. */
export function periodPricesFromInvoice(invoice: InvoiceExtraction): PeriodPrices {
  return {
    power: {
      P1: powerPrice(invoice.powerLines, "P1"),
      P2: powerPrice(invoice.powerLines, "P2"),
    },
    energy: energyPrices(invoice),
  };
}

/**
 * Precios que paga hoy el cliente, sacados de las líneas de su factura, para
 * calcular su coste anual con la misma fórmula que las ofertas. Devuelve null
 * si falta algún precio necesario.
 */
export function currentTariffFromInvoice(
  invoice: InvoiceExtraction,
): CurrentTariff | null {
  const { power, energy } = periodPricesFromInvoice(invoice);
  if (
    [...Object.values(power), ...Object.values(energy)].some(
      (price) => price === null,
    )
  ) {
    return null;
  }

  const energyAmount = invoice.energyLines.reduce(
    (sum, { amount }) => sum + amount,
    0,
  );
  const energyDiscountRates =
    energyAmount > 0
      ? invoice.energyDiscounts.map(
          ({ description, amount }) =>
            (Math.abs(amount) / energyAmount) * shareOfYear(description, amount),
        )
      : [];

  const days = invoice.billingPeriod?.days ?? 0;
  const servicesInPeriod = invoice.otherTaxableLines.reduce(
    (sum, { description, amount }) => sum + amount * shareOfYear(description, amount),
    0,
  );
  const otherElectricityInPeriod = invoice.otherElectricityLines.reduce(
    (sum, { amount }) => sum + amount,
    0,
  );
  const vatExemptInPeriod = invoice.vatExemptLines.reduce(
    (sum, { amount }) => sum + amount,
    0,
  );

  return {
    prices: {
      power: power as TariffPrices["power"],
      energy: energy as TariffPrices["energy"],
      servicesPerYear:
        days > 0 ? (servicesInPeriod * DAYS_PER_YEAR) / days : undefined,
      otherElectricityPerYear:
        days > 0 ? (otherElectricityInPeriod * DAYS_PER_YEAR) / days : undefined,
      vatExemptPerYear:
        days > 0 ? (vatExemptInPeriod * DAYS_PER_YEAR) / days : undefined,
    },
    energyDiscountRates,
    // Importe entre días: vale aunque la factura no imprima el €/día.
    meterRentalPerDay: meterRentalPerDay(invoice),
  };
}

/**
 * Tipos del impuesto eléctrico y del IVA (o IGIC, IPSI) que lleva la factura,
 * para aplicar a las ofertas los mismos que paga el cliente. Solo se usa un
 * tipo si cuadra con su base y su importe; si no, queda el general.
 */
export function invoiceTaxRates(
  invoice: InvoiceExtraction,
): { electricityTaxRate?: number; vatRate?: number } {
  const consistent = (
    tax: { base: number; ratePercent: number; amount: number } | null,
    maxPercent: number,
  ): number | undefined => {
    if (!tax || tax.base <= 0) return undefined;
    const rate = tax.ratePercent / 100;
    if (rate < 0 || rate > maxPercent / 100) return undefined;
    return Math.abs(tax.base * rate - tax.amount) <= 0.02 ? rate : undefined;
  };
  return {
    electricityTaxRate: consistent(invoice.electricityTax, 6),
    vatRate: consistent(invoice.vat, 25),
  };
}
