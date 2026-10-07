/**
 * Banco de pruebas de la ingesta de anexos de precios.
 *
 *   pnpm eval:rates <fichero> [<fichero>…] [--estimate] [--max-usd 0.25]
 *                   [--models a,b] [--supplier "Nombre"|carpeta] [--out carpeta]
 *                   [--recipes plantillas.json]
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
 *
 * Excel: se leen con plantilla. --recipes guarda las plantillas en un JSON
 * local para comprobar que se reutilizan entre versiones (sin coste).
 * --supplier carpeta usa el nombre de la carpeta de cada fichero.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
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
import { renderGrid } from "@/comparador/rates/sheets/grid";
import { RECIPE_INSTRUCTIONS } from "@/comparador/rates/sheets/read";
import { memoryRecipeStore } from "@/comparador/rates/sheets/store";
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
    recipes: readOption(argv, "--recipes"),
    // El plan gratuito admite 5 peticiones por minuto y modelo.
    delayMs: Number(readOption(argv, "--delay-ms") ?? 13_000),
  };
}

type PriceTable = Map<string, { input: number; output: number }>;

/** Salida prevista de una plantilla de Excel (unas pocas tablas). */
const RECIPE_OUTPUT_TOKENS = 8_000;

function estimateUsd(prices: PriceTable, models: readonly string[], document: PreparedDocument) {
  // Un Excel se lee con plantilla: entra el libro con coordenadas (como mucho
  // 120.000 caracteres) y sale la plantilla, no las filas.
  if (document.grids?.length) {
    const workbookChars = Math.min(
      document.grids.reduce((sum, grid) => sum + renderGrid(grid, 30_000).length, 0),
      120_000,
    );
    const input = (RECIPE_INSTRUCTIONS.length + workbookChars) / CHARS_PER_TOKEN;
    return models.reduce((total, model) => {
      const price = prices.get(model);
      if (!price) throw new Error(`Sin precio en la Gateway para ${model}`);
      return total + input * price.input + RECIPE_OUTPUT_TOKENS * price.output;
    }, 0);
  }
  const promptChars =
    RATE_INSTRUCTIONS.length + JSON.stringify(z.toJSONSchema(RateDocumentSchema)).length;
  const calls = 1;
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
    total += inputTokens * price.input + OUTPUT_TOKENS * calls * price.output;
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
        `${document.text?.length ?? 0} caracteres de texto` +
        (document.grids ? `, ${document.grids.length} hojas (plantilla)` : `, ${document.sentChars} enviados`) +
        " · " +
        `peor caso ${usd(estimate)}`,
    );
  }
  const total = prepared.reduce((sum, { estimate }) => sum + estimate, 0);
  console.log(`\nPeor caso en total: ${usd(total)} · tope: ${usd(options.maxUsd)}\n`);
  if (options.estimateOnly) return;

  await mkdir(options.out, { recursive: true });
  const recipes = memoryRecipeStore();
  if (options.recipes && existsSync(options.recipes)) {
    const saved = JSON.parse(await readFile(options.recipes, "utf8")) as [string, never][];
    for (const [key, entry] of saved) recipes.entries.set(key, entry);
  }
  const supplierFor = (file: string) =>
    options.supplier === "carpeta"
      ? basename(dirname(file)).replace(/^\d{4}-\d{2}-\d{2}$/, basename(dirname(dirname(file))))
      : options.supplier;
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
      supplierName: supplierFor(file),
      models: options.models,
      recipes,
    });
    if (options.recipes) {
      await writeFile(options.recipes, JSON.stringify([...recipes.entries], null, 1));
    }
    tracked += result.costUsd ?? 0;
    spent = Math.max(tracked, startBalance - (await balance()));

    const name = basename(file).replace(/[^\w.-]/g, "_");
    await writeFile(join(options.out, `${name}.json`), JSON.stringify(result, null, 2));

    const reader = result.reader
      ? ` · plantilla ${{ cache: "reutilizada", repaired: "reparada", generated: "nueva", none: "ninguna" }[result.reader.source]} (${result.reader.tables} tablas)`
      : "";
    if (result.status === "out_of_scope") {
      console.log(`${basename(file)}: fuera de alcance${reader} · ${result.reason} · ${usd(result.costUsd ?? 0)}`);
      continue;
    }
    const inScope = result.proposed.filter(isInScope).length;
    console.log(
      `${basename(file)}: ${result.status} · ${inScope} filas 2.0TD fijas, ` +
        `${result.extraction.commissions.length} comisiones · ` +
        `${result.attempts.map(({ model }) => model).join(" → ") || "sin IA"}${reader} · ${usd(result.costUsd ?? 0)}`,
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
