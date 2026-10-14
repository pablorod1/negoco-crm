import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { roundEuros, sumEuros } from "@/comparador/engine/money";
import type { InvoiceExtraction } from "./invoice-schema";
import { expectedTaxableBase } from "./validate";

const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

/**
 * Pasa a €/kW·día las líneas de potencia que la factura da por mes o por año.
 * Lo hace nuestro código y no la IA, para que la conversión sea siempre la
 * misma: un mes son 365/12 días.
 */
export function normalizePowerLines(invoice: InvoiceExtraction): InvoiceExtraction {
  return {
    ...invoice,
    powerLines: invoice.powerLines.map((line) => {
      const original = line.originalPrice;
      if (!original) return line;

      if (original.unit === "kW·mes") {
        // Si la factura no dice los meses, salen del importe: kW × meses × precio.
        const months =
          original.months ??
          (line.kw > 0 && original.price > 0
            ? line.amount / (line.kw * original.price)
            : null);
        return {
          ...line,
          days: months !== null ? months * DAYS_PER_MONTH : line.days,
          pricePerKwDay: original.price / DAYS_PER_MONTH,
        };
      }

      return { ...line, pricePerKwDay: original.price / DAYS_PER_YEAR };
    }),
  };
}

/** Diferencia admitida entre dos importes en euros redondeados al céntimo. */
const CENT = 0.011;

/**
 * Algunas facturas solo dan el importe del IVA («Impuesto NORMAL 21%
 * (12,08 €)»), sin la base, y la IA pone ese importe como base imponible e
 * inventa otro IVA. Si las líneas, el tipo y el total cuadran entre sí (base
 * de las líneas × tipo = total − base), la base y el IVA están demostrados y
 * se corrigen. Solo cuando la factura trae esa cifra de IVA: si no, la lectura
 * es otra cosa y la validación debe seguir avisando.
 */
export function reconcileVat(invoice: InvoiceExtraction): InvoiceExtraction {
  const vat = invoice.vat;
  if (!vat || invoice.total === null) return invoice;
  const base = expectedTaxableBase(invoice);
  const exempt = sumEuros(invoice.vatExemptLines.map(({ amount }) => amount));
  const vatAmount = roundEuros(invoice.total - exempt - base);
  if (vatAmount <= 0 || Math.abs((base * vat.ratePercent) / 100 - vatAmount) > CENT) return invoice;

  const consistent = Math.abs(vat.base - base) <= CENT && Math.abs(vat.amount - vatAmount) <= CENT;
  if (consistent) return invoice;
  const readTheVat = [invoice.taxableBase, vat.base, vat.amount].some(
    (value) => value !== null && Math.abs(value - vatAmount) <= CENT,
  );
  if (!readTheVat) return invoice;

  return { ...invoice, taxableBase: base, vat: { ...vat, base, amount: vatAmount } };
}

/** Lo que solo dicen las facturas de precio indexado, PVPC incluido. */
const INDEXED_WORDS = /indexad[oa]|precio\s*diario|\bPVPC\b/i;

/** Energía en €/kWh de un periodo, con sus conceptos (peajes, cargos…) sumados. */
function energyPrice(invoice: InvoiceExtraction, period: "P2" | "P3"): number {
  return invoice.energyLines
    .filter((line) => line.period === period)
    .reduce((sum, line) => sum + line.pricePerKwh, 0);
}

/**
 * Corrige un «fixed» o «unknown» de la IA cuando la factura demuestra que es
 * indexada: lo dice el texto («producto indexado», «precio diario», PVPC), o
 * el valle cuesta más que el llano, que ninguna tarifa fija hace. Es lo que
 * se propone al comercial; él lo confirma en el estudio.
 */
export function inferPricing(invoice: InvoiceExtraction, text: string | null): InvoiceExtraction {
  if (invoice.pricing === "indexed" || invoice.pricing === "flat") return invoice;
  const llano = energyPrice(invoice, "P2");
  const valleOverLlano = llano > 0 && energyPrice(invoice, "P3") > llano + 0.001;
  if (valleOverLlano || (text !== null && INDEXED_WORDS.test(text))) {
    return { ...invoice, pricing: "indexed" };
  }
  return invoice;
}

/**
 * Sin fechas en la factura (Jazztel: «Alquiler contador 0,026630 €/día × 31»),
 * los días del periodo salen de lo que se cobra por día: el alquiler del
 * contador, el bono social o la potencia en €/kW·día. Solo si coinciden.
 */
export function fillBillingDays(invoice: InvoiceExtraction): InvoiceExtraction {
  if (invoice.billingPeriod) return invoice;
  const daily = [
    invoice.meterRental?.days,
    ...invoice.socialBonusLines.map(({ days }) => days),
    ...invoice.powerLines.filter(({ originalPrice }) => !originalPrice).map(({ days }) => days),
  ].filter((days): days is number => typeof days === "number" && Number.isInteger(days) && days > 0);
  const values = new Set(daily);
  if (values.size !== 1) return invoice;
  return { ...invoice, billingPeriod: { from: null, to: null, days: [...values][0] } };
}

/**
 * Un único precio de energía para todo el consumo (Repsol: «294 kWh x
 * 0,111681 €/kWh») a veces llega como P1. Si la línea cubre los kWh de los
 * tres periodos, es un precio para todos: ALL.
 */
export function singleEnergyPriceAsAll(invoice: InvoiceExtraction): InvoiceExtraction {
  const periods = new Set(invoice.energyLines.map(({ period }) => period));
  if (periods.size !== 1 || periods.has("ALL")) return invoice;
  const { P1, P2, P3 } = invoice.consumptionKwh;
  const [period] = periods;
  const others = (["P1", "P2", "P3"] as const).filter((other) => other !== period);
  if (!others.some((other) => (invoice.consumptionKwh[other] ?? 0) > 0)) return invoice;
  const total = (P1 ?? 0) + (P2 ?? 0) + (P3 ?? 0);
  const covered = invoice.energyLines.every(({ kwh }) => Math.abs(kwh - total) <= 1);
  if (!covered) return invoice;
  return { ...invoice, energyLines: invoice.energyLines.map((line) => ({ ...line, period: "ALL" as const })) };
}
