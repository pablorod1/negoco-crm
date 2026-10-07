import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import {
  createGateway,
  generateText,
  Output,
  type LanguageModelUsage,
  type ModelMessage,
  type ProviderMetadata,
} from "ai";
import type { z } from "zod";
import {
  recordAiUsage,
  type AiJobContext,
  type RecordAiUsage,
} from "./usage";

let gatewayProvider: ReturnType<typeof createGateway> | null = null;

function getGateway() {
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VERCEL_AI_GATEWAY_API_KEY");
  }
  gatewayProvider ??= createGateway({ apiKey });
  return gatewayProvider;
}

type GatewayCallOptions = Required<
  Pick<
    GatewayProviderOptions,
    "zeroDataRetention" | "disallowPromptTraining" | "tags"
  >
> & { user?: string };

/**
 * Opciones de la Gateway en cada llamada: solo proveedores sin retención de
 * datos ni entrenamiento con ellos, y etiquetas para repartir el gasto.
 */
export function buildGatewayOptions(
  context: AiJobContext,
): GatewayCallOptions {
  return {
    zeroDataRetention: true,
    disallowPromptTraining: true,
    tags: [`tenant:${context.tenantSlug}`, `job:${context.jobType}`],
    ...(context.userId ? { user: context.userId } : {}),
  };
}

function readGatewayNumber(
  metadata: ProviderMetadata | undefined,
  key: string,
): number | null {
  const value = metadata?.gateway?.[key];
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric)
    ? numeric
    : null;
}

function readGatewayString(
  metadata: ProviderMetadata | undefined,
  key: string,
): string | null {
  const value = metadata?.gateway?.[key];
  return typeof value === "string" && value ? value : null;
}

/** Tope de tokens de salida: una ficha completa ocupa menos de 2.000. */
const MAX_OUTPUT_TOKENS = 6_000;

/**
 * Opciones propias de cada proveedor. Los GPT-5 razonan por defecto y ese
 * razonamiento se factura como salida; para copiar cifras basta el mínimo.
 */
export function buildProviderSpecificOptions(
  model: string,
): Record<string, Record<string, string | Record<string, number>>> {
  if (model.startsWith("openai/gpt-5")) {
    return { openai: { reasoningEffort: "minimal" } };
  }
  // Gemini 2.5 razona por defecto y puede agotar el tope de salida.
  if (model.startsWith("google/gemini-2.5")) {
    const thinking = { thinkingConfig: { thinkingBudget: 0 } };
    return { google: thinking, vertex: thinking };
  }
  return {};
}

export interface StructuredRequest<SCHEMA extends z.ZodType> {
  context: AiJobContext;
  /** Id de modelo de la Gateway, por ejemplo `google/gemini-2.5-flash-lite`. */
  model: string;
  schema: SCHEMA;
  instructions: string;
  messages: ModelMessage[];
  recordUsage?: RecordAiUsage;
}

export interface StructuredResult<T> {
  output: T;
  model: string;
  usage: LanguageModelUsage;
  costUsd: number | null;
}

/**
 * Llamada con salida estructurada a través de Vercel AI Gateway. Registra el
 * uso tanto si sale bien como si falla.
 */
export async function generateStructured<SCHEMA extends z.ZodType>({
  context,
  model,
  schema,
  instructions,
  messages,
  recordUsage = recordAiUsage,
}: StructuredRequest<SCHEMA>): Promise<StructuredResult<z.infer<SCHEMA>>> {
  try {
    const result = await generateText({
      model: getGateway()(model),
      output: Output.object({ schema }),
      instructions,
      messages,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: {
        gateway: buildGatewayOptions(context),
        ...buildProviderSpecificOptions(model),
      },
    });

    const costUsd = readGatewayNumber(result.providerMetadata, "cost");
    await recordUsage({
      context,
      model,
      inputTokens: result.totalUsage.inputTokens ?? null,
      outputTokens: result.totalUsage.outputTokens ?? null,
      totalTokens: result.totalUsage.totalTokens ?? null,
      costUsd,
      generationId: readGatewayString(result.providerMetadata, "generationId"),
      succeeded: true,
      error: null,
    });

    return {
      output: result.output as z.infer<SCHEMA>,
      model,
      usage: result.totalUsage,
      costUsd,
    };
  } catch (error) {
    await recordUsage({
      context,
      model,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costUsd: null,
      generationId: null,
      succeeded: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
    });
    throw error;
  }
}
