/**
 * Modelos de la cascada de extracción de facturas, del más barato al más
 * fuerte. Elegidos con el banco de evaluación sobre las 18 fichas del piloto
 * (6 de octubre de 2026): 78 % de facturas sin corrección, 17 % a revisión y
 * ningún error silencioso que cambie el coste, a unos 0,006 $ por factura.
 */
export const INVOICE_EXTRACTION_MODELS = [
  "google/gemini-2.5-flash",
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
