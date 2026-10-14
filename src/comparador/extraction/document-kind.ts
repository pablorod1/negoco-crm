/**
 * Documentos que se suben como «factura» y no lo son: contratos, estudios
 * comparativos de otra comercializadora, hojas de precios, facturas de otra
 * tarifa de acceso. Se reconocen por el texto, antes de llamar a la IA: no
 * se gasta en algo que no se puede comparar y el comercial sabe qué pasa.
 */

/** Lo que trae cualquier factura: su total o su periodo de facturación. */
const INVOICE_MARKERS =
  /total\s+(?:a\s+pagar|factura|importe(?:\s+factura)?|invoiced)|importe\s+(?:total|factura)|periodo\s+de\s+facturaci[oó]n|billing\s+period|readings\s+from/i;

const CONTRACT =
  /contrato\s+de\s+suministro\s+de\s+energ[ií]a[\s\S]{0,400}condiciones\s+(?:particulares|generales)|fecha\s+oferta/i;
const COMPARISON_STUDY = /sin\s+validez\s+contractual|estudio\s+comparativo/i;
/** El número de la factura: lo trae toda factura y ninguna hoja de precios. */
const INVOICE_NUMBER = /n[ºo°*”]\s*(?:de\s+)?factura|factura\s+n[ºo°*”]|invoice\s+(?:no|number)/i;
const ACCESS_TARIFF = /(?:tarifa|peaje)\s+de\s+acceso\s*:?\s*(\d)[.,](\d)\s?T\.?D/gi;

export type NotAnInvoice =
  | { kind: "contract" | "comparison" | "price_sheet"; message: string }
  | { kind: "other_tariff"; message: string };

const MESSAGES = {
  contract: "Este documento es un contrato, no una factura. Sube la última factura de luz del cliente.",
  comparison:
    "Este documento es un estudio comparativo de otra comercializadora, no una factura. Sube la última factura de luz del cliente.",
  price_sheet: "Este documento es una hoja de precios o condiciones, no una factura. Sube la última factura de luz del cliente.",
} as const;

/**
 * Por qué el documento no es una factura 2.0TD; null si lo parece. Con OCR
 * no se descarta por faltar el total o el número: puede no haberlo leído.
 */
export function notAnInvoice(text: string, { fromImage = false } = {}): NotAnInvoice | null {
  const head = text.slice(0, 3000);
  if (COMPARISON_STUDY.test(text)) return { kind: "comparison", message: MESSAGES.comparison };
  if (CONTRACT.test(head)) return { kind: "contract", message: MESSAGES.contract };
  if (!fromImage && !INVOICE_MARKERS.test(text) && !INVOICE_NUMBER.test(text)) {
    return { kind: "price_sheet", message: MESSAGES.price_sheet };
  }
  const tariffs = new Set([...text.matchAll(ACCESS_TARIFF)].map(([, major, minor]) => `${major}.${minor}`));
  if (tariffs.size === 1 && !tariffs.has("2.0")) {
    const [tariff] = tariffs;
    return {
      kind: "other_tariff",
      message: `Es una factura de ${tariff}TD; el comparador compara suministros 2.0TD (hasta 15 kW).`,
    };
  }
  return null;
}
