import type { EnergyByPeriod } from "@/comparador/engine/types";
import type { StudySupply } from "./supply";

const PERIODS = ["P1", "P2", "P3"] as const;

/**
 * Precio de energía de un año con una tarifa indexada. Su comercializadora le
 * cobra el mercado más un margen (peajes, cargos, SSAA, su fee…): el margen
 * sale de su factura frente al OMIE de esos mismos días, y se suma al OMIE de
 * cada lectura del SIPS. Devuelve el precio medio de cada periodo, ponderado
 * por lo que consumió en cada lectura; null sin lecturas o sin mercado.
 */
export function indexedEnergyPrices(invoicePrices: EnergyByPeriod, supply: StudySupply): EnergyByPeriod | null {
  const { market, readings } = supply;
  if (!market || !readings?.length || market.readings.length !== readings.length) return null;
  const result = { P1: 0, P2: 0, P3: 0 };
  for (const period of PERIODS) {
    const margin = invoicePrices[period] - market.invoice[period] / 1000;
    const kwh = readings.reduce((sum, reading) => sum + reading.kwh[period], 0);
    const weighted =
      kwh > 0
        ? readings.reduce((sum, reading, index) => sum + reading.kwh[period] * market.readings[index][period], 0) / kwh
        : market.readings.reduce((sum, prices) => sum + prices[period], 0) / market.readings.length;
    result[period] = margin + weighted / 1000;
  }
  return result;
}

/**
 * Lo que su factura cobra de media por encima del mercado, en €/kWh,
 * ponderado por su consumo en la factura: peajes, cargos y el margen de su
 * comercializadora. Es lo que Beenergy mira para saber qué fee le aplican.
 */
export function marginOverMarket(
  invoicePrices: EnergyByPeriod,
  supply: StudySupply,
  invoiceKwh: Partial<Record<(typeof PERIODS)[number], number | null>>,
): number | null {
  const market = supply.market;
  if (!market) return null;
  const total = PERIODS.reduce((sum, period) => sum + (invoiceKwh[period] ?? 0), 0);
  if (total <= 0) return null;
  return PERIODS.reduce(
    (sum, period) => sum + (invoiceKwh[period] ?? 0) * (invoicePrices[period] - market.invoice[period] / 1000),
    0,
  ) / total;
}
