/**
 * Banco de pruebas de la ingesta de anexos de precios.
 *
 *   pnpm eval:rates <fichero> [<fichero>…] [--estimate] [--max-usd 0.25]
 *                   [--models a,b] [--supplier "Nombre"] [--out carpeta]
 *
 * Prepara cada documento como en producción (PDF e imágenes enteros, Excel a
 * CSV, texto tal cual) y lo extrae con la cascada. Los anexos no llevan datos
 * personales, pero sí condiciones comerciales: no usarlo con documentos de
 * clientes.
 *
 * Gasto: --estimate solo prepara los documentos y calcula el coste previsto.
 * Siempre hay un tope (--max-usd, 0,25 $ por defecto) medido con el saldo de la
 * Gateway: el banco se para antes de un documento que pueda pasarlo. Cada
 * resultado se guarda en --out (por defecto ~/negoco-golden/precios/eval) para
 * analizarlo sin volver a pagarlo.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { createGateway } from "ai";
import { z } from "zod";
import {
  getRateExtractionModels,
  RATE_CLASSIFICATION_MODEL,
} from "@/comparador/ai/models";
import { prepareDocument, type PreparedDocument } from "@/comparador/rates/document";
import { extractRateDocument, RATE_INSTRUCTIONS } from "@/comparador/rates/extract";
import { RateDocumentSchema } from "@/comparador/rates/schema";
import { isInScope } from "@/comparador/rates/validate";
import { loadLocalEnv, readOption } from "./golden/paths";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".html": "text/html",
};

const CHARS_PER_TOKEN = 3;
/** Tokens que factura Gemini por página de PDF o por imagen (pesimista). */
const TOKENS_PER_PAGE = 600;
/** Salida prevista: el anexo de Iberdrola (45 filas de 2.0TD) gastó ~18.000. */
const OUTPUT_TOKENS = 20_000;

const usd = (value: number) => `${value.toFixed(4)} $`;

function parseArgs(argv: string[]) {
  const files: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index].startsWith("--")) {
      if (!["--estimate"].includes(argv[index])) index++;
      continue;
    }
    files.push(argv[index]);
  }
  return {
    files,
    estimateOnly: argv.includes("--estimate"),
    maxUsd: Number(readOption(argv, "--max-usd") ?? 0.25),
    models: readOption(argv, "--models")?.split(",").filter(Boolean) ?? [
      ...getRateExtractionModels(),
    ],
    supplier: readOption(argv, "--supplier") ?? null,
    out: readOption(argv, "--out") ?? join(homedir(), "negoco-golden/precios/eval"),
    // El plan gratuito admite 5 peticiones por minuto y modelo.
    delayMs: Number(readOption(argv, "--delay-ms") ?? 13_000),
  };
}

type PriceTable = Map<string, { input: number; output: number }>;

function estimateUsd(prices: PriceTable, models: readonly string[], document: PreparedDocument) {
  const promptChars =
    RATE_INSTRUCTIONS.length + JSON.stringify(z.toJSONSchema(RateDocumentSchema)).length;
  const inputTokens =
    (promptChars + document.sentChars) / CHARS_PER_TOKEN +
    (document.format === "pdf" || document.format === "image"
      ? (document.pages ?? 1) * TOKENS_PER_PAGE
      : 0);
  const classification = prices.get(RATE_CLASSIFICATION_MODEL);
  let total = classification ? (8_000 / CHARS_PER_TOKEN) * classification.input : 0;
  for (const model of models) {
    const price = prices.get(model);
    if (!price) throw new Error(`Sin precio en la Gateway para ${model}`);
    total += inputTokens * price.input + OUTPUT_TOKENS * price.output;
  }
  return total;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv.slice(2));
  if (options.files.length === 0) {
    console.log("Uso: pnpm eval:rates <fichero> [<fichero>…] [--estimate] [--max-usd 0.25]");
    return;
  }

  const gateway = createGateway({ apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY });
  const { models: available } = await gateway.getAvailableModels();
  const prices: PriceTable = new Map(
    available
      .filter((model) => model.pricing)
      .map((model) => [
        model.id,
        { input: Number(model.pricing!.input), output: Number(model.pricing!.output) },
      ]),
  );

  const prepared: { file: string; document: PreparedDocument; estimate: number }[] = [];
  for (const file of options.files) {
    const data = new Uint8Array(await readFile(file));
    const mime = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
    const document = await prepareDocument({ kind: "file", name: basename(file), mime, data });
    const estimate = estimateUsd(prices, options.models, document);
    prepared.push({ file, document, estimate });
    console.log(
      `${basename(file)}: ${document.format}, ${document.pages ?? "-"} pág., ` +
        `${document.text?.length ?? 0} caracteres de texto, ${document.sentChars} enviados · ` +
        `peor caso ${usd(estimate)}`,
    );
  }
  const total = prepared.reduce((sum, { estimate }) => sum + estimate, 0);
  console.log(`\nPeor caso en total: ${usd(total)} · tope: ${usd(options.maxUsd)}\n`);
  if (options.estimateOnly) return;

  await mkdir(options.out, { recursive: true });
  const balance = async () => Number((await gateway.getCredits()).balance);
  const startBalance = await balance();
  let tracked = 0;
  let spent = 0;

  for (const [index, { file, document, estimate }] of prepared.entries()) {
    if (spent + estimate > options.maxUsd) {
      console.log(`Parado por el tope antes de ${basename(file)}.`);
      break;
    }
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, options.delayMs));

    const result = await extractRateDocument({
      document,
      context: { tenantSlug: "eval", jobType: "rate_extraction", subjectId: basename(file) },
      supplierName: options.supplier,
      models: options.models,
    });
    tracked += result.costUsd ?? 0;
    spent = Math.max(tracked, startBalance - (await balance()));

    const name = basename(file).replace(/[^\w.-]/g, "_");
    await writeFile(join(options.out, `${name}.json`), JSON.stringify(result, null, 2));

    if (result.status === "out_of_scope") {
      console.log(`${basename(file)}: fuera de alcance · ${result.reason}`);
      continue;
    }
    const inScope = result.proposed.filter(isInScope).length;
    console.log(
      `${basename(file)}: ${result.status} · ${inScope} filas 2.0TD fijas, ` +
        `${result.extraction.commissions.length} comisiones · ` +
        `${result.attempts.map(({ model }) => model).join(" → ")} · ${usd(result.costUsd ?? 0)}`,
    );
    for (const issue of result.issues.filter(({ severity }) => severity !== "info")) {
      console.log(`  [${issue.severity}] ${issue.message}`);
    }
  }
  console.log(`\nGastado: ${usd(spent)} (saldo inicial ${usd(startBalance)})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
