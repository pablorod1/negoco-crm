import { generateStructured } from "@/comparador/ai/gateway";
import { getInvoiceExtractionModels } from "@/comparador/ai/models";
import type { AiJobContext } from "@/comparador/ai/usage";
import { buildMessages, type ExtractionAttempt, type InvoiceFile } from "@/comparador/extraction/extract-invoice";
import { isValidCups, repairCups } from "@/comparador/extraction/identifiers";
import { hasBlockingIssues, type InvoiceIssue } from "@/comparador/extraction/validate";
import { normalizeGasReading, toStudyExtraction, validateGasInvoice, type GasStudyExtraction } from "./invoice";
import { GasInvoiceExtractionSchema, type GasInvoiceExtraction } from "./invoice-schema";

export const GAS_INSTRUCTIONS = `Extraes datos de facturas españolas de gas natural para un comparador de tarifas.
Copia las cifras exactamente como aparecen en la factura, con su signo. No calcules ni redondees nada.
Si un dato no aparece, devuélvelo como null. No lo deduzcas.
Si la factura es de luz y gas, extrae solo la parte del gas: su CUPS, su periodo, sus líneas, y el IVA, la base y el total del gas si la factura los da por separado; si solo da el total conjunto, total null.
El término fijo (o «término de disponibilidad», «cuota fija») va en fixedTermLines: si la factura lo da en €/día, en pricePerDay; si lo da en €/mes o €/año, no conviertas nada: copia el precio, la unidad y los meses facturados en originalPrice.
El término variable (o «término de energía», «consumo») va en energyLines en €/kWh, una línea por tramo de fechas o concepto. Si la factura da el consumo en m³, copia los m³ en consumptionM3, el factor de conversión en conversionFactor y los kWh en consumptionKwh.
El impuesto especial sobre hidrocarburos va en hydrocarbonTax con sus kWh y su precio en €/kWh.
El canon IRC, los cánones de la distribuidora, la cuota del Gestor Técnico del Sistema (GTS) y la tasa de la CNMC, si van en una línea propia, van en regulatedLines (nunca en el término fijo ni en el variable). Los servicios que se cobran en cada factura (mantenimiento, asistencia, packs, seguros con IVA) y sus descuentos van en otherTaxableLines.
Si el periodo no tiene consumo (0 kWh), energyLines va vacío: no pongas como energía otros importes. Los cargos que no se repiten (inspección periódica, alta, enganche, acometida, depósito, derechos de conexión, regularizaciones de lecturas) van en oneOffLines.
Cada descuento va en discounts con appliesTo: energy si es sobre el término variable o el consumo, fixed si es sobre el término fijo, both si es sobre los dos, amount si es un importe en euros.
regulatedTur es true solo si la factura es de la tarifa de último recurso (TUR, «tarifa regulada») de una comercializadora de referencia.
Si la factura aplica dos tipos de IVA (por ejemplo, 10 % al gas y 21 % al alquiler o al canon), pon una línea por tipo en vatLines con su base y su importe.
Extrae solo las líneas que suman al importe de la factura: los desgloses informativos (peajes incluidos, «destino del importe») no son líneas.
Si el documento trae varias facturas seguidas, extrae solo la más reciente.
Las fechas, en formato YYYY-MM-DD. Los porcentajes, como número (21, no 0,21).`;

export interface GasExtractionResult {
  status: "ok" | "needs_review";
  extraction: GasStudyExtraction;
  issues: InvoiceIssue[];
  attempts: ExtractionAttempt[];
}

/**
 * Extrae una factura de gas en cascada, como la de luz: el modelo siguiente
 * solo entra si la lectura no cuadra, y se queda la que menos incidencias
 * que bloquean tiene.
 */
export async function extractGasInvoice({
  file,
  context,
  knownCups = null,
  models = getInvoiceExtractionModels(),
  generate = generateStructured,
}: {
  file: InvoiceFile;
  context: AiJobContext;
  /** CUPS leído en local con su dígito de control: manda sobre el de la IA. */
  knownCups?: string | null;
  models?: readonly string[];
  generate?: typeof generateStructured;
}): Promise<GasExtractionResult> {
  if (models.length === 0) throw new Error("No extraction models configured");
  const attempts: ExtractionAttempt[] = [];
  let best: { reading: GasInvoiceExtraction; issues: InvoiceIssue[] } | null = null;
  const blocking = (list: readonly InvoiceIssue[]) => list.filter(({ severity }) => severity === "blocking").length;

  for (const model of models) {
    const result = await generate({
      context,
      model,
      schema: GasInvoiceExtractionSchema,
      instructions: GAS_INSTRUCTIONS,
      messages: buildMessages(file),
    });
    const normalized = normalizeGasReading(result.output);
    const cups = knownCups ?? (normalized.cups && !isValidCups(normalized.cups) ? (repairCups(normalized.cups) ?? normalized.cups) : normalized.cups);
    const reading = { ...normalized, cups };
    const issues = validateGasInvoice(reading);
    attempts.push({
      model,
      issues,
      costUsd: result.costUsd,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      usedSupplierHint: false,
    });
    if (!best || blocking(issues) < blocking(best.issues)) best = { reading, issues };
    if (!hasBlockingIssues(issues) || issues.some(({ severity }) => severity === "unsupported")) break;
  }

  const final = best!;
  return {
    status: hasBlockingIssues(final.issues) ? "needs_review" : "ok",
    extraction: toStudyExtraction(final.reading),
    issues: final.issues,
    attempts,
  };
}
