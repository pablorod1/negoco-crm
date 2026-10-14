import type { ModelMessage } from "ai";
import { generateStructured } from "@/comparador/ai/gateway";
import { getInvoiceExtractionModels } from "@/comparador/ai/models";
import type { AiJobContext } from "@/comparador/ai/usage";
import {
  InvoiceExtractionSchema,
  type InvoiceExtraction,
} from "./invoice-schema";
import {
  alignEnergyKwh,
  deriveMissingEnergyPrice,
  exactElectricityTaxRate,
  fillBillingDays,
  inferPricing,
  meterRentalFromText,
  normalizePowerLines,
  reconcileChain,
  reconcileVat,
  regulatedSocialBonusPrice,
  repairedCups,
  singleEnergyPriceAsAll,
  surplusCompensationAsOther,
} from "./normalize";
import { getSupplierHint } from "./supplier-hints";
import {
  hasBlockingIssues,
  validateInvoice,
  type InvoiceIssue,
} from "./validate";

const BASE_INSTRUCTIONS = `Extraes datos de facturas españolas de electricidad para un comparador de tarifas.
Copia las cifras exactamente como aparecen en la factura, con su signo. No calcules ni redondees nada.
Si un dato no aparece, devuélvelo como null. No lo deduzcas.
Las líneas de energía van en €/kWh. Las de potencia, en €/kW·día; si la factura da la potencia en €/kW·mes o €/kW·año, no conviertas nada: copia el precio, la unidad y los meses en originalPrice.
Si la energía aparece en dos conceptos por periodo (por ejemplo «término de energía» y «peajes y cargos»), extrae una línea por concepto y periodo.
El periodo de una línea de energía es P1, P2 o P3 solo si la factura lo dice (P1, P2, P3, punta, llano, valle). Los tramos de fechas, las «horas promocionadas» y cualquier otro reparto no son periodos: usa ALL.
Un margen que se cobra por kW y día (como el «margen de comercialización fijo» del PVPC) es potencia: va en powerLines, en P1 si la factura no dice el periodo. Los demás márgenes, los excesos de potencia y la energía reactiva van en otherElectricityLines.
La financiación del bono social va solo en socialBonusLines, aunque la factura la agrupe en «cargos normativos».
Si la factura solo da el total de un grupo de líneas (por ejemplo, el término de energía de los tres periodos), pon ese total en la primera línea del grupo y 0 en las demás.
Si un precio por día (alquiler, bono social) no aparece en la factura, déjalo en null.
La 2.0TD tiene dos periodos de potencia: el de punta (o punta-llano) es P1 y el de valle es P2, aunque la factura lo llame P3.
Extrae solo las líneas que suman al importe de la factura. Los desgloses informativos («cuantía de peajes y cargos», «destino del importe», «incluido en el importe facturado…») no son líneas: ignóralos.
El consumo por periodo (consumptionKwh) es el de punta, llano y valle que indica la factura; no lo saques de las líneas de precio.
Si el documento trae varias facturas seguidas, extrae solo la más reciente.
Las fechas, en formato YYYY-MM-DD. Los porcentajes, como número (21, no 0,21).`;

export interface InvoiceDocument {
  data: Uint8Array;
  mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
}

/**
 * La factura como archivo (PDF o imagen), como varias fotos de la misma
 * factura, o como texto ya extraído y anonimizado en local, que no lleva
 * datos personales.
 */
export type InvoiceFile = InvoiceDocument | { pages: InvoiceDocument[] } | { text: string };

export interface ExtractionAttempt {
  model: string;
  issues: InvoiceIssue[];
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  usedSupplierHint: boolean;
}

export interface InvoiceExtractionResult {
  /** `ok`: sin incidencias bloqueantes. `needs_review`: hay que corregir datos. */
  status: "ok" | "needs_review";
  extraction: InvoiceExtraction;
  issues: InvoiceIssue[];
  attempts: ExtractionAttempt[];
}

export function buildInstructions(supplierHint: string | null): string {
  return supplierHint
    ? `${BASE_INSTRUCTIONS}\n\nParticularidades de esta comercializadora:\n${supplierHint}`
    : BASE_INSTRUCTIONS;
}

function buildMessages(file: InvoiceFile): ModelMessage[] {
  if ("text" in file) {
    return [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae los datos de esta factura. Es el texto de la factura con los datos personales tapados entre corchetes.\n\n${file.text}`,
          },
        ],
      },
    ];
  }

  const pages = "pages" in file ? file.pages : [file];
  return [
    {
      role: "user",
      content: [
        ...pages.map(({ data, mediaType }) => ({ type: "file" as const, data, mediaType })),
        {
          type: "text",
          text:
            pages.length > 1
              ? `Extrae los datos de esta factura. Son ${pages.length} fotos de la misma factura, en orden.`
              : "Extrae los datos de esta factura.",
        },
      ],
    },
  ];
}

/**
 * Extrae una factura en cascada: empieza por el modelo más barato y solo pasa
 * al siguiente si la extracción no cuadra. A partir del segundo intento añade
 * la ficha de la comercializadora detectada. Si ningún modelo consigue una
 * extracción coherente, devuelve la última para revisión manual.
 */
export async function extractInvoice({
  file,
  context,
  knownCups = null,
  models = getInvoiceExtractionModels(),
  generate = generateStructured,
}: {
  file: InvoiceFile;
  context: AiJobContext;
  /**
   * CUPS leído en local con su dígito de control. Manda sobre el de la IA,
   * que con el texto anonimizado ni siquiera lo ve.
   */
  knownCups?: string | null;
  models?: readonly string[];
  generate?: typeof generateStructured;
}): Promise<InvoiceExtractionResult> {
  if (models.length === 0) throw new Error("No extraction models configured");

  const attempts: ExtractionAttempt[] = [];
  let last: { extraction: InvoiceExtraction; issues: InvoiceIssue[] } | null =
    null;

  for (const model of models) {
    const hint: string | null = last
      ? getSupplierHint(last.extraction.supplierName)
      : null;
    const result: {
      output: InvoiceExtraction;
      costUsd: number | null;
      usage?: { inputTokens?: number; outputTokens?: number };
    } = await generate({
      context,
      model,
      schema: InvoiceExtractionSchema,
      instructions: buildInstructions(hint),
      messages: buildMessages(file),
    });

    const text = "text" in file ? file.text : null;
    const normalized = inferPricing(
      reconcileVat(
        reconcileChain(
          singleEnergyPriceAsAll(
            alignEnergyKwh(
              surplusCompensationAsOther(
                deriveMissingEnergyPrice(
                  exactElectricityTaxRate(
                    fillBillingDays(regulatedSocialBonusPrice(meterRentalFromText(normalizePowerLines(result.output), text))),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      text,
    );
    const output = knownCups ? { ...normalized, cups: knownCups } : repairedCups(normalized);
    const issues = validateInvoice(output);
    attempts.push({
      model,
      issues,
      costUsd: result.costUsd,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      usedSupplierHint: hint !== null,
    });
    last = { extraction: output, issues };

    // Una factura fuera de alcance no mejora con un modelo más caro.
    const outOfScope = issues.some(({ severity }) => severity === "unsupported");
    if (!hasBlockingIssues(issues) || outOfScope) break;
  }

  const final = last!;
  return {
    status: hasBlockingIssues(final.issues) ? "needs_review" : "ok",
    extraction: final.extraction,
    issues: final.issues,
    attempts,
  };
}
