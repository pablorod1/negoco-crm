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
