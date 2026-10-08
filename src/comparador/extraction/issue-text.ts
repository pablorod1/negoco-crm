import type { InvoiceIssue, InvoiceIssueCode } from "./validate";

export const ISSUE_TEXT: Partial<Record<InvoiceIssueCode, string>> = {
  not_2_0td: "La factura no es de 2.0TD.",
  indexed_pricing: "La factura es de precio indexado.",
  power_line_mismatch: "Las líneas de potencia no cuadran (kW × días × precio).",
  energy_line_mismatch: "Las líneas de energía no cuadran (kWh × precio).",
  social_bonus_mismatch: "El bono social no cuadra.",
  meter_rental_mismatch: "El alquiler del contador no cuadra.",
  consumption_mismatch: "El consumo por periodo no cuadra con las líneas de energía.",
  energy_period_unpriced: "Falta el precio de energía de algún periodo.",
  power_period_unpriced: "Falta el precio de potencia de algún periodo.",
  electricity_tax_base_mismatch: "La base del impuesto eléctrico no cuadra.",
  electricity_tax_mismatch: "El impuesto eléctrico no cuadra.",
  taxable_base_mismatch: "La base imponible no cuadra.",
  vat_mismatch: "El IVA no cuadra.",
  total_mismatch: "El total de la factura no cuadra con sus líneas.",
  read_from_image: "Factura leída de una imagen: comprueba lo que paga hoy contra el original.",
};

/** Campos de la factura en palabras, para «La factura no trae…». */
const FIELD_TEXT: Record<string, string> = {
  "billingPeriod.days": "los días facturados",
  "contractedKw.P1": "la potencia contratada P1",
  "contractedKw.P2": "la potencia contratada P2",
  "consumptionKwh.P1": "el consumo P1",
  "consumptionKwh.P2": "el consumo P2",
  "consumptionKwh.P3": "el consumo P3",
  powerLines: "las líneas de potencia",
  energyLines: "las líneas de energía",
  total: "el total",
  vat: "el IVA",
  electricityTax: "el impuesto eléctrico",
};

/**
 * Avisos de la factura en palabras. Los del titular y el CUPS no se enseñan:
 * se tapan antes de analizarla y el CUPS lo lee el CRM.
 */
export function issueMessages(issues: readonly InvoiceIssue[]) {
  return issues
    .filter(({ code, field }) => !["cups_invalid", "tax_id_invalid"].includes(code) && !/^(holder|cups|supplyAddress)/.test(field))
    .map((issue) => ({
      severity: issue.severity,
      message:
        ISSUE_TEXT[issue.code] ??
        (issue.code === "missing_field"
          ? `La factura no trae ${FIELD_TEXT[issue.field] ?? issue.field}.`
          : `Revisa ${FIELD_TEXT[issue.field] ?? issue.field}.`),
    }));
}

