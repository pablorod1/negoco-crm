import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import type { InvoiceExtraction } from "./invoice-schema";

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
