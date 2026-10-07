import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import type { TariffPrices } from "@/comparador/engine/types";
import type { InvoiceExtraction } from "./invoice-schema";

export interface CurrentTariff {
  prices: TariffPrices;
  /** Descuentos sobre la energía en tanto por uno, para repetirlos al año. */
  energyDiscountRates: number[];
  meterRentalPerDay: number;
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
 * único (ALL) se suman a todos los periodos.
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
    if (kwh <= 0) return null;
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
      ? invoice.energyDiscounts.map(({ amount }) => Math.abs(amount) / energyAmount)
      : [];

  const days = invoice.billingPeriod?.days ?? 0;
  const servicesInPeriod = invoice.otherTaxableLines.reduce(
    (sum, { amount }) => sum + amount,
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
