import { NoObjectGeneratedError } from "ai";
import { readSpreadsheet, type SheetReadResult } from "./sheets/read";
import { controlRecipeStore, type RecipeStore } from "./sheets/store";
import { generateStructured } from "@/comparador/ai/gateway";
import {
  getRateExtractionModels,
  getSheetRecipeModels,
  RATE_CLASSIFICATION_MODEL,
} from "@/comparador/ai/models";
import type { AiJobContext } from "@/comparador/ai/usage";
import type { PreparedDocument } from "./document";
import { toProposedCommissions, toProposedRates } from "./normalize";
import {
  RateDocumentClassificationSchema,
  RateDocumentSchema,
  type RateDocumentClassification,
  type RateDocumentExtraction,
} from "./schema";
import type { ProposedRate } from "./types";
import {
  hasBlockingIssues,
  isInScope,
  validateProposedRates,
  type RateIssue,
} from "./validate";

export const RATE_INSTRUCTIONS = `Extraes precios de anexos de comercializadoras españolas de electricidad para un comparador de tarifas.
Extrae SOLO las tarifas 2.0TD (potencia contratada hasta 15 kW). De lo demás (3.0TD, 6.1TD, gas, servicios) no extraigas filas: resúmelo en skipped.
Copia las cifras exactamente como aparecen, con todos sus decimales, y su unidad. No conviertas ni redondees ningún precio.
Una fila por cada combinación distinta de producto, nivel, territorio, canal (captación o renovación), banda de potencia o de consumo, mes de inicio y duración. Si el documento da varios niveles o columnas del mismo producto (N1/N2/N3, Agencia/Estándar/Cliente, Alto/Medio/Bajo, T0…T4, I…IV, Nivel 1…3), cada uno es una fila con su level.
productName es el nombre comercial sin el nivel, la tarifa de acceso ni la banda: «Plan Estable», no «2.0TD_2 Plan Estable».
Energía: si el producto tiene un único precio para todas las horas, singlePrice true y el precio en energyP1, aunque el documento lo repita o ponga ceros en P2 y P3. Si tiene tres precios: energyP1 punta, energyP2 llano, energyP3 valle.
Potencia: copia powerP1 (punta) y powerP2 (valle) con su unidad. Si el documento dice que la potencia es la regulada, «BOE» o «peajes y cargos», powerMode regulated. Si es la regulada más un único margen, powerMode regulated_plus y el margen en powerMargin. Si el documento no da la potencia, powerMode not_stated.
Si aparece un precio anterior y uno nuevo, extrae el nuevo. Si aparece un precio con descuento y otro sin descuento, extrae el precio sin descuento y añade el descuento en discounts. Un descuento que depende de contratar servicios, de una franja elegida u otra condición lleva conditional true.
Si el precio es una base a la que el comercial suma un fee, indica sus límites en feeMinMwh y feeMaxMwh (€/MWh).
pricing: fixed para precio fijo por periodos P1/P2/P3 o precio único; indexed si la energía depende del mercado (OMIE, pool, indexado, pass-through); flat para tarifas planas o cuotas fijas mensuales; other si la energía va por franjas propias que no son los periodos P1/P2/P3 (horas promocionadas, «8 horas», noche, fin de semana, vehículo eléctrico).
Si un producto ofrece modalidades en las que un precio o un descuento solo vale en unas horas o días (día, noche, laborables, fin de semana, «horas Open») y fuera de ellas se paga otro precio, cada una de esas modalidades es pricing other, aunque el documento le dé un único precio. Solo la modalidad que vale las 24 horas todos los días es fixed.
Que los servicios de ajuste vayan incluidos o aparte se indica solo en ancillaryIncluded, nunca en level.
Si el consumo máximo depende del fee que elija el comercial (por ejemplo, «sin fee hasta 8.000 kWh, fee 10 hasta 15.000 kWh»), haz una fila por fee, con ese fee en feeMinMwh y feeMaxMwh, su consumo máximo y sin consumo mínimo.
partialUpdate es true si el documento solo anuncia cambios en algunos precios (por ejemplo, una imagen con el nuevo precio de la energía) y no la tarifa completa.
Si el documento trae comisiones de la agencia (marco o modelo retributivo, comisiones), extráelas en commissions: fixed para euros por contrato, per_mwh para euros por MWh de consumo, fee_share para un porcentaje del fee (con feeBase energy o power). Indica en accessTariff y pricing la sección del documento a la que pertenece cada comisión; déjalos en null solo si vale para todo. Los tramos de consumo, en kWh: si el documento los da en MWh, multiplícalos por 1000 (es la única conversión permitida).
validFrom es la fecha desde la que valen los precios («entrada en vigor», «válidos desde»); si el documento solo da su fecha de publicación o de última actualización, úsala como validFrom. validTo, solo si el documento dice hasta cuándo valen.
Los textos de los descuentos, breves. Las fechas, en formato YYYY-MM-DD.`;

const CLASSIFICATION_INSTRUCTIONS = `Clasificas documentos que llegan a una agencia de energía española. Indica si traen precios de tarifas de luz o gas, comisiones de la agencia, qué tarifas de acceso aparecen (2.0TD, 3.0TD, 6.1TD, RL1…) y si los precios son fijos, indexados o tarifas planas. Responde solo con lo que se ve en el texto.`;

/**
 * Tope de salida por llamada, cerca del máximo de Gemini 2.5 Flash (65.536).
 * Solo se paga lo que se usa: el anexo de Iberdrola (~45 filas) gastó ~18.000.
 */
const RATE_MAX_OUTPUT_TOKENS = 60_000;
const CLASSIFICATION_CHARS = 8_000;

export interface RateExtractionAttempt {
  model: string;
  issues: RateIssue[];
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Cómo se ha leído un Excel: con la plantilla guardada o con una nueva. */
export type SheetReader = SheetReadResult["recipe"];

export type RateExtractionResult =
  | {
      status: "out_of_scope";
      reason: string;
      classification: RateDocumentClassification;
      costUsd: number | null;
      reader?: SheetReader;
    }
  | {
      status: "ok" | "needs_review";
      classification: RateDocumentClassification | null;
      extraction: RateDocumentExtraction;
      proposed: ProposedRate[];
      issues: RateIssue[];
      attempts: RateExtractionAttempt[];
      costUsd: number | null;
      reader?: SheetReader;
    };

/** Motivo para no extraer, o `null` si el documento merece la extracción. */
export function outOfScopeReason(
  classification: RateDocumentClassification,
): string | null {
  if (!classification.hasPrices && !classification.hasCommissions) {
    return "El documento no trae precios ni comisiones.";
  }
  if (classification.hasCommissions) return null;

  const tariffs = classification.accessTariffs.map((tariff) =>
    tariff.replace(/\s+/g, "").toUpperCase(),
  );
  if (tariffs.length > 0 && !tariffs.some((tariff) => /^2[.,]?0TD$/.test(tariff))) {
    return `Solo trae ${tariffs.join(", ")}; la v1 compara 2.0TD.`;
  }
  // Si los precios son fijos o indexados lo decide la extracción: el modelo
  // barato confunde, por ejemplo, la revisión por IPC con un indexado.
  return null;
}

function addCost(total: number | null, cost: number | null): number | null {
  return cost === null ? total : (total ?? 0) + cost;
}

/** Errores que un modelo más fuerte puede corregir; la potencia ausente, no. */
function worthRetrying(issues: readonly RateIssue[]): boolean {
  return issues.some(
    ({ severity, code }) =>
      severity === "blocking" &&
      [
        "not_in_source",
        "missing_energy",
        "energy_out_of_range",
        "power_out_of_range",
        "duplicate_row",
      ].includes(code),
  );
}

export class RateDocumentTooLargeError extends Error {
  constructor(detail: string) {
    super(
      `No se ha podido leer el documento (${detail}). Si es muy largo, sube solo las páginas de 2.0TD.`,
    );
    this.name = "RateDocumentTooLargeError";
  }
}

/**
 * Clasifica el documento con el modelo más barato y, si trae precios 2.0TD
 * fijos o comisiones, los extrae en cascada: el modelo siguiente solo entra si
 * la extracción no cuadra con el texto del documento. Los Excel no pasan por
 * aquí: se leen con una plantilla (sheets/read.ts) y sus cifras salen de las
 * celdas.
 */
export async function extractRateDocument({
  document,
  context,
  supplierName = null,
  models = getRateExtractionModels(),
  generate = generateStructured,
  recipes = controlRecipeStore(),
  recipeModels = getSheetRecipeModels(),
}: {
  document: PreparedDocument;
  context: AiJobContext;
  /** Comercializadora que indica quien sube el documento, si la indica. */
  supplierName?: string | null;
  models?: readonly string[];
  generate?: typeof generateStructured;
  /** Plantillas de lectura de Excel; `null` para no guardarlas ni buscarlas. */
  recipes?: RecipeStore | null;
  /** Modelos para escribir plantillas de Excel. */
  recipeModels?: readonly string[];
}): Promise<RateExtractionResult> {
  if (models.length === 0) throw new Error("No rate extraction models configured");

  // Nunca se le piden a la IA las filas de un Excel: con uno grande eso
  // costaba 0,25 $ y se cortaba.
  if (document.grids?.length) {
    const { result, recipe } = await readSpreadsheet({
      grids: document.grids,
      supplierName,
      context,
      store: recipes,
      models: recipeModels,
      generate,
    });
    return { ...result, reader: recipe };
  }

  let costUsd: number | null = null;
  let classification: RateDocumentClassification | null = null;
  if (document.text) {
    // La clasificación solo ahorra la extracción de lo que no es 2.0TD: si
    // su respuesta no se puede leer (Candela), se extrae igualmente.
    const result = await generate({
      context: { ...context, jobType: "classification" },
      model: RATE_CLASSIFICATION_MODEL,
      schema: RateDocumentClassificationSchema,
      instructions: CLASSIFICATION_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: document.text.slice(0, CLASSIFICATION_CHARS) }],
        },
      ],
      maxOutputTokens: 1_000,
    }).catch((error: unknown) => {
      if (NoObjectGeneratedError.isInstance(error)) return null;
      throw error;
    });
    if (result) {
      classification = result.output;
      costUsd = addCost(costUsd, result.costUsd);
      const reason = outOfScopeReason(classification);
      if (reason) return { status: "out_of_scope", reason, classification, costUsd };
    }
  }

  const instructions =
    RATE_INSTRUCTIONS +
    (supplierName ? `\n\nEl documento es de la comercializadora ${supplierName}.` : "");
  const attempts: RateExtractionAttempt[] = [];
  let extraction: RateDocumentExtraction | null = null;

  for (const model of models) {
    let result;
    try {
      result = await generate({
        context: { ...context, jobType: "rate_extraction" },
        model,
        schema: RateDocumentSchema,
        instructions,
        messages: [
          {
            role: "user",
            content: [
              ...document.parts,
              { type: "text", text: "Extrae los precios 2.0TD y las comisiones de este documento." },
            ],
          },
        ],
        maxOutputTokens: RATE_MAX_OUTPUT_TOKENS,
      });
    } catch (error) {
      // Una respuesta cortada no mejora con un modelo más caro.
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new RateDocumentTooLargeError(
          error.finishReason === "length"
            ? "la respuesta no cabe en una llamada"
            : "la respuesta de la IA no se ha podido leer",
        );
      }
      throw error;
    }
    costUsd = addCost(costUsd, result.costUsd);
    extraction = result.output;

    const proposed = toProposedRates(extraction, document.text);
    const issues = validateProposedRates(proposed, {
      sourceText: document.text,
      partialUpdate: extraction.partialUpdate,
      validFrom: extraction.validFrom,
    });
    attempts.push({
      model,
      issues,
      costUsd: result.costUsd,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
    });
    if (!worthRetrying(issues)) break;
  }

  const final = extraction!;
  const proposed = toProposedRates(final, document.text);
  let issues = validateProposedRates(proposed, {
    sourceText: document.text,
    partialUpdate: final.partialUpdate,
    validFrom: final.validFrom,
  });
  // Un documento de solo comisiones no trae precios: no es un error.
  if (toProposedCommissions(final).length > 0) {
    issues = issues.filter(({ code }) => code !== "no_rates");
  }

  if (
    proposed.filter(isInScope).length === 0 &&
    toProposedCommissions(final).length === 0 &&
    classification
  ) {
    // La extracción no encuentra nada que guardar: indexadas, por franjas…
    return {
      status: "out_of_scope",
      reason: `No trae precios fijos de 2.0TD${final.skipped.length ? ` (${final.skipped.join(", ")})` : ""}.`,
      classification,
      costUsd,
    };
  }
  return {
    status: hasBlockingIssues(issues) ? "needs_review" : "ok",
    classification,
    extraction: final,
    proposed,
    issues,
    attempts,
    costUsd,
  };
}
