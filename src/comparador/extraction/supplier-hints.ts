import { normalizeProviderName } from "@/crm-settings/utils";

/**
 * Fichas de formato por comercializadora: dónde está cada dato y qué tiene de
 * particular su factura. Solo se añade al prompt la de la comercializadora
 * detectada. Se amplían con las facturas del conjunto de prueba.
 */
const SUPPLIER_HINTS: readonly { match: RegExp; hint: string }[] = [
  {
    match: /iberdrola/,
    hint: [
      "Iberdrola puede partir la energía y la financiación del bono social en varias líneas por tramos de fechas: extrae cada línea por separado.",
      "Los descuentos sobre el consumo (por ejemplo 5 % y 20 % sobre el importe de energía) van en energyDiscounts, en negativo.",
      "El alquiler de equipos y los packs (por ejemplo Pack Iberdrola Hogar y su descuento) van en «Servicios y otros conceptos»: el alquiler en meterRental y el pack en otherTaxableLines.",
      "El alquiler puede cubrir días distintos de los de la potencia.",
    ].join("\n"),
  },
  {
    match: /naturgy/,
    hint: [
      "Naturgy muestra un «Subtotal» que ya incluye la financiación del bono social: es la base del impuesto eléctrico.",
      "Puede usar un único precio de energía para todo el consumo: usa period ALL.",
    ].join("\n"),
  },
  {
    match: /endesa/,
    hint: [
      "Endesa resume los importes en la primera página y detalla el cálculo más abajo: usa el detalle.",
      "La base del impuesto eléctrico aparece entre paréntesis en la línea del impuesto.",
    ].join("\n"),
  },
];

export function getSupplierHint(supplierName: string | null): string | null {
  if (!supplierName) return null;
  const normalized = normalizeProviderName(supplierName)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return SUPPLIER_HINTS.find(({ match }) => match.test(normalized))?.hint ?? null;
}
