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
const COMPARISON_STUDY =
  /sin\s+validez\s+contractual|estudio\s+comparativo|reducci[oó]n\s+respecto\s+a\s+tu\s+factura\s+actual|menos\s+en\s+tu\s+factura\s+el[eé]ctrica/i;
/** El número de la factura: lo trae toda factura y ninguna hoja de precios. */
const INVOICE_NUMBER = /n[ºo°*”]\s*(?:de\s+)?factura|factura\s+n[ºo°*”]|invoice\s+(?:no|number)/i;
const ACCESS_TARIFF = /(?:tarifa|peaje)\s+de\s+acceso\s*:?\s*(\d)[.,](\d)\s?T\.?D/gi;

/**
 * Lo que solo trae una factura de gas: el peaje RL, los m³, el impuesto de
 * hidrocarburos. «Gas natural» no: las de luz lo nombran en el origen de la
 * electricidad («ciclo combinado de gas natural»).
 */
const GAS_MARKERS = /\bRL\.?\s?0?[1-9]\b|\bTUR\.?\s?[1-4]\b|hidrocarburos|\bm(?:3|³)\b|factor\s+de\s+conversi[oó]n/i;
/** Lo que solo trae una de luz: la tarifa TD, la potencia en kW, el impuesto eléctrico. */
const ELECTRICITY_MARKERS = /\b[236][.,]?[01]\s?TD\b|potencia\s+contratada|impuesto\s+(?:especial\s+)?(?:sobre\s+la\s+)?electricidad|\bkW\b|impuesto\s+el[eé]ctrico/i;

export type NotAnInvoice =
  | { kind: "contract" | "comparison" | "price_sheet"; message: string }
  | { kind: "other_tariff" | "other_energy"; message: string };

export const NOT_INVOICE_MESSAGES = {
  contract: "Este documento es un contrato, no una factura. Sube la última factura de luz del cliente.",
  comparison:
    "Este documento es un estudio comparativo de otra comercializadora, no una factura. Sube la última factura de luz del cliente.",
  price_sheet: "Este documento es una hoja de precios o condiciones, no una factura. Sube la última factura de luz del cliente.",
} as const;

/** Los mensajes de una comparativa de gas: piden la factura de gas. */
const forEnergy = (message: string, energy: "electricity" | "gas") =>
  energy === "gas" ? message.replace("factura de luz", "factura de gas") : message;

/**
 * Por qué el documento no es una factura que se pueda comparar (2.0TD, o gas
 * en una comparativa de gas); null si lo parece. Con OCR no se descarta por
 * faltar el total o el número: puede no haberlo leído.
 */
export function notAnInvoice(
  text: string,
  { fromImage = false, energy = "electricity" }: { fromImage?: boolean; energy?: "electricity" | "gas" } = {},
): NotAnInvoice | null {
  const head = text.slice(0, 3000);
  if (COMPARISON_STUDY.test(text)) return { kind: "comparison", message: forEnergy(NOT_INVOICE_MESSAGES.comparison, energy) };
  if (CONTRACT.test(head)) return { kind: "contract", message: forEnergy(NOT_INVOICE_MESSAGES.contract, energy) };
  if (!fromImage && !INVOICE_MARKERS.test(text) && !INVOICE_NUMBER.test(text)) {
    return { kind: "price_sheet", message: forEnergy(NOT_INVOICE_MESSAGES.price_sheet, energy) };
  }
  // Una factura de luz en una comparativa de gas, o al revés. Las de luz y
  // gas juntas traen las dos cosas: valen para las dos.
  const gasLike = GAS_MARKERS.test(text);
  const electricityLike = ELECTRICITY_MARKERS.test(text);
  if (energy === "gas" && electricityLike && !gasLike) {
    return { kind: "other_energy", message: "Es una factura de luz y esta comparativa es de gas. Sube la factura de gas del cliente." };
  }
  if (energy === "gas") return null;
  if (gasLike && !electricityLike) {
    return { kind: "other_energy", message: "Es una factura de gas y esta comparativa es de luz. Crea una comparativa de gas para compararla." };
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
