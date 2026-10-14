import { experimental_decide as decide, type Experimental_DecisionQuestion } from "ai";
import { buildGatewayOptions, getGateway } from "@/comparador/ai/gateway";
import { recordAiUsage, type AiJobContext, type RecordAiUsage } from "@/comparador/ai/usage";
import type { InvoiceExtraction } from "./invoice-schema";

/**
 * Comprobación independiente de una lectura con Jev (TypeSafe AI), un modelo
 * de decisión: no lee cifras, contesta preguntas de sí o no sobre el texto
 * con una probabilidad. Medido el 14 de octubre de 2026 con el banco (95
 * facturas, 1.205 afirmaciones): por debajo de 0,5 caen el 98 % de las
 * afirmaciones falsas. Con el consumo, preguntado sin mencionar la tabla de
 * lecturas, dudaba de consumos bien leídos (Endesa, Naturgy); con la pregunta
 * de ahora, 1 falsa alarma de 45 en las facturas difíciles y el 89 % de los
 * valores falsos detectados. Cazó una tabla de consumos leída al revés por
 * Luna y por GPT-5 a la vez. ~0,00015 $ por factura.
 */
export const VERIFICATION_MODEL = "typesafe-ai/jev";
const PRICE_PER_INPUT_TOKEN = 0.042 / 1e6;

/** Por debajo, el dato se marca como dudoso en el editor. */
export const DOUBT_BELOW = 0.5;
/**
 * Por encima, se cree a Jev que el documento no es una factura. «Otra tarifa»
 * no se usa: tomó una factura 2.0TD de Endesa por otra tarifa con 0,78.
 */
export const NOT_INVOICE_FROM = 0.9;

const DOCUMENT_KINDS = {
  factura: "Factura de electricidad",
  contrato: "Contrato, condiciones particulares o generales de suministro",
  estudio_comparativo: "Estudio, simulación o comparativa de ahorro hecha por otra empresa",
  hoja_precios: "Hoja de precios, tarifas o condiciones de un producto",
  otro: "Otro documento",
} as const;

const NOT_INVOICE_KIND = {
  contrato: "contract",
  estudio_comparativo: "comparison",
  hoja_precios: "price_sheet",
} as const;

export interface ReadingCheck {
  /** Qué es el documento, si Jev está seguro de que no es una factura. */
  notInvoice: (typeof NOT_INVOICE_KIND)[keyof typeof NOT_INVOICE_KIND] | null;
  /** Campos de la lectura que Jev no ve en la factura. */
  doubtfulFields: string[];
}

const number = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 3 });

/** Las afirmaciones que se comprueban, con el campo de la lectura al que se refieren. */
function statements(reading: InvoiceExtraction): [string, string][] {
  const out: [string, string][] = [];
  const periods = { P1: "punta (P1)", P2: "llano (P2)", P3: "valle (P3)" } as const;
  for (const period of ["P1", "P2", "P3"] as const) {
    const kwh = reading.consumptionKwh[period];
    if (kwh !== null) {
      // Sin la tabla de lecturas en la pregunta, Jev dudaba de consumos bien
      // leídos de ella (Endesa, Naturgy): 14 de 45 falsas alarmas; así, 1.
      out.push([
        `consumptionKwh.${period}`,
        `El consumo del periodo de ${periods[period]} en esta factura es de ${number(kwh)} kWh. Puede aparecer en el resumen, en las líneas de energía o en la tabla de lecturas por periodo (lectura anterior, lectura actual y consumo de punta, llano y valle).`,
      ]);
    }
  }
  if (reading.billingPeriod) {
    out.push(["billingPeriod.days", `El periodo facturado es de ${reading.billingPeriod.days} días.`]);
  }
  for (const period of ["P1", "P2"] as const) {
    const kw = reading.contractedKw[period];
    if (kw !== null) {
      out.push([`contractedKw.${period}`, `La potencia contratada en ${period === "P1" ? "punta (P1)" : "valle (P2)"} es de ${number(kw)} kW.`]);
    }
  }
  if (reading.supplierName) {
    out.push(["supplierName", `La comercializadora que emite la factura es ${reading.supplierName}.`]);
  }
  out.push([
    "hasSelfConsumption",
    reading.hasSelfConsumption
      ? "La factura incluye autoconsumo o compensación de excedentes de energía vertida a la red."
      : "La factura no incluye autoconsumo ni compensación de excedentes.",
  ]);
  return out;
}

/**
 * Comprueba la lectura de una factura en texto. Si Jev no responde, devuelve
 * null y el estudio sigue igual: es una red, no un paso obligatorio.
 */
export async function verifyReading({
  text,
  reading,
  context,
  decideFn = decide,
  recordUsage = recordAiUsage,
}: {
  /** El texto anonimizado que leyó la IA. */
  text: string;
  reading: InvoiceExtraction;
  context: AiJobContext;
  decideFn?: typeof decide;
  recordUsage?: RecordAiUsage;
}): Promise<ReadingCheck | null> {
  const checks = statements(reading);
  const questions: Record<string, Experimental_DecisionQuestion> = {
    tipo: { type: "choice", instructions: "¿Qué es este documento?", criteria: DOCUMENT_KINDS },
  };
  checks.forEach(([, statement], index) => (questions[`q${index}`] = { type: "boolean", instructions: statement }));

  try {
    const result = await decideFn({
      model: getGateway().decisionModel(VERIFICATION_MODEL),
      state: `Texto de un documento subido como factura de luz. Los datos personales están tapados entre corchetes.\n\n${text}`,
      questions,
      providerOptions: { gateway: buildGatewayOptions(context) },
    });
    const inputTokens = result.usage.inputTokens ?? null;
    await recordUsage({
      context,
      model: VERIFICATION_MODEL,
      inputTokens,
      outputTokens: result.usage.outputTokens ?? null,
      totalTokens: result.usage.totalTokens ?? null,
      costUsd: inputTokens === null ? null : inputTokens * PRICE_PER_INPUT_TOKEN,
      generationId: null,
      succeeded: true,
      error: null,
    });

    const answers = result.answers as Record<string, { type: string; choice?: string; probability?: number; probabilities?: Record<string, number> }>;
    const kind = answers.tipo;
    const kindProbability = kind?.choice ? (kind.probabilities?.[kind.choice] ?? 0) : 0;
    const notInvoice =
      kind?.choice && kind.choice in NOT_INVOICE_KIND && kindProbability >= NOT_INVOICE_FROM
        ? NOT_INVOICE_KIND[kind.choice as keyof typeof NOT_INVOICE_KIND]
        : null;
    const doubtfulFields = checks
      .filter((_, index) => {
        const answer = answers[`q${index}`];
        return answer?.type === "boolean" && typeof answer.probability === "number" && answer.probability < DOUBT_BELOW;
      })
      .map(([field]) => field);
    return { notInvoice, doubtfulFields };
  } catch (error) {
    await recordUsage({
      context,
      model: VERIFICATION_MODEL,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costUsd: null,
      generationId: null,
      succeeded: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
    });
    return null;
  }
}
