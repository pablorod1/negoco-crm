/**
 * Modelos de la cascada de extracción de facturas, del más barato al más
 * fuerte. Elegidos con el banco de evaluación sobre las 15 fichas reales del
 * piloto (14 de octubre de 2026): con texto, GPT-6 Luna (razonamiento «low»)
 * deja 11 sin corrección y 1 error silencioso, a ~0,0008 $ por factura;
 * Gemini 2.5 Flash, 10 y 1 a ~0,0028 $. Con OCR, 5 sin corrección los dos
 * (Luna 1 silencioso, Gemini 2). Haiku 5.5 falla el esquema (27 campos con
 * null; Anthropic admite 16) y razonar «medium» no mejora a Luna.
 */
export const INVOICE_EXTRACTION_MODELS = [
  "openai/gpt-6-luna",
  "openai/gpt-5",
] as const;

/**
 * Modelos que acepta el crédito gratuito de la Gateway (comprobado el 6 de
 * octubre de 2026). GPT-6, Gemini 3.x, Claude, Qwen y DeepSeek solo funcionan
 * con crédito de pago.
 */
export const FREE_TIER_MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "openai/gpt-5-nano",
  "openai/gpt-5-mini",
  "openai/gpt-5",
  "openai/gpt-4.1-mini",
  "mistral/mistral-small",
  "mistral/mistral-large-3",
  "meta/llama-3.3-70b",
] as const;

/**
 * Cascada de extracción de anexos de precios. Gemini lee los PDF de forma
 * nativa (unos 258 tokens por página); GPT-5 solo entra si la extracción no
 * cuadra con el documento.
 */
export const RATE_EXTRACTION_MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-5",
] as const;

/**
 * Cascada para escribir plantillas de Excel: Gemini, otra vez Gemini con la
 * lista de lo que no encajó y, en último lugar, GPT-5 mini. GPT-5 corrigiendo
 * una plantilla de ADX costó 0,10 $; una plantilla no necesita tanto.
 */
export const SHEET_RECIPE_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
] as const;

export function getSheetRecipeModels(
  env: Record<string, string | undefined> = process.env,
): readonly string[] {
  const configured = env.COMPARADOR_SHEET_MODELS?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return configured?.length ? configured : SHEET_RECIPE_MODELS;
}

/** Clasificación previa de un anexo: solo mira el principio del texto. */
export const RATE_CLASSIFICATION_MODEL = "google/gemini-2.5-flash-lite";

/** Igual que la de facturas, configurable con `COMPARADOR_RATE_MODELS`. */
export function getRateExtractionModels(
  env: Record<string, string | undefined> = process.env,
): readonly string[] {
  const configured = env.COMPARADOR_RATE_MODELS?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return configured?.length ? configured : RATE_EXTRACTION_MODELS;
}

/**
 * Cascada en uso. `COMPARADOR_INVOICE_MODELS` (ids separados por comas)
 * permite cambiarla desde Vercel sin desplegar, una vez validada con el banco
 * de evaluación.
 */
export function getInvoiceExtractionModels(
  env: Record<string, string | undefined> = process.env,
): readonly string[] {
  const configured = env.COMPARADOR_INVOICE_MODELS?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return configured?.length ? configured : INVOICE_EXTRACTION_MODELS;
}
