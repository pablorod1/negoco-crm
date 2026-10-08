/**
 * Banco de evaluación de la extracción de facturas.
 *
 *   pnpm eval:invoices [carpeta] [--models a,b] [--cascade] [--limit N]
 *                      [--max-usd 0.25] [--estimate] [--out informe.json]
 *                      [--redacted redacted-ocr]
 *
 * Sin carpeta usa el conjunto de prueba (`~/negoco-golden/piloto`): envía a la
 * IA solo el texto anonimizado y añade el CUPS leído en local, como en
 * producción. Con una carpeta de pares `<nombre>.pdf` + `<nombre>.json` envía
 * el documento: no usarlo con facturas reales sin el encargo de tratamiento.
 *
 * Gasto: --estimate solo calcula el coste previsto. Siempre hay un tope
 * (--max-usd, 0,25 $ por defecto): el banco se para antes de una llamada que
 * pueda pasarlo. El uso se registra en la base de control con el tenant `eval`.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createGateway } from "ai";
import { z } from "zod";
import { getInvoiceExtractionModels } from "@/comparador/ai/models";
import {
  evaluateExtraction,
  summarizeEvaluations,
  type EvaluationOptions,
  type InvoiceEvaluation,
} from "@/comparador/extraction/evaluation";
import {
  buildInstructions,
  extractInvoice,
  type InvoiceFile,
} from "@/comparador/extraction/extract-invoice";
import {
  InvoiceExtractionSchema,
  type InvoiceExtraction,
} from "@/comparador/extraction/invoice-schema";
import { DEFAULT_GOLDEN_DIR, loadLocalEnv, readOption } from "./golden/paths";

const MEDIA_TYPES: Record<string, "application/pdf" | "image/jpeg" | "image/png" | "image/webp"> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Caracteres por token en texto en español; algo pesimista a propósito. */
const CHARS_PER_TOKEN = 3;
/** Tokens de salida previstos por factura: una ficha completa y su envoltorio. */
const OUTPUT_TOKENS_PER_INVOICE = 2_000;

interface GoldenCase {
  name: string;
  file: InvoiceFile;
  expected: InvoiceExtraction;
  options: EvaluationOptions;
  inputChars: number;
}

function parseArgs(argv: string[]) {
  const positional = argv[0] && !argv[0].startsWith("--") ? argv[0] : undefined;
  const models =
    readOption(argv, "--models")?.split(",").filter(Boolean) ?? [
      ...getInvoiceExtractionModels(),
    ];
  return {
    folder: positional ?? DEFAULT_GOLDEN_DIR,
    models,
    cascade: argv.includes("--cascade"),
    estimateOnly: argv.includes("--estimate"),
    limit: Number(readOption(argv, "--limit") ?? Infinity),
    maxUsd: Number(readOption(argv, "--max-usd") ?? 0.25),
    // El plan gratuito admite 5 peticiones por minuto y modelo.
    delayMs: Number(readOption(argv, "--delay-ms") ?? 13_000),
    out: readOption(argv, "--out"),
    // Carpeta del texto anonimizado: `redacted-ocr` evalúa la lectura con OCR.
    redacted: readOption(argv, "--redacted") ?? "redacted",
  };
}

async function loadGoldenDir(folder: string, redacted: string): Promise<GoldenCase[]> {
  const ids = (await readdir(join(folder, "fichas")))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .sort();

  return Promise.all(
    ids.map(async (id) => {
      const text = await readFile(join(folder, redacted, `${id}.txt`), "utf8");
      const privateData = JSON.parse(
        await readFile(join(folder, "private", `${id}.json`), "utf8"),
      ) as { cups: string[] };
      return {
        name: id,
        file: { text },
        expected: InvoiceExtractionSchema.parse(
          JSON.parse(await readFile(join(folder, "fichas", `${id}.json`), "utf8")),
        ),
        // Con el texto anonimizado la IA no ve CUPS ni NIF: no se puntúan.
        options: {
          ignore: ["cups", "holderTaxId"],
          localCups: privateData.cups[0] ?? null,
        },
        inputChars: text.length,
      };
    }),
  );
}

async function loadPairs(folder: string): Promise<GoldenCase[]> {
  const entries = await readdir(folder);
  const cases: GoldenCase[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".json")).sort()) {
    const name = basename(entry, ".json");
    const document = entries.find(
      (candidate) =>
        basename(candidate, extname(candidate)) === name &&
        MEDIA_TYPES[extname(candidate).toLowerCase()],
    );
    if (!document) continue;

    const data = new Uint8Array(await readFile(join(folder, document)));
    cases.push({
      name,
      file: { data, mediaType: MEDIA_TYPES[extname(document).toLowerCase()] },
      expected: InvoiceExtractionSchema.parse(
        JSON.parse(await readFile(join(folder, entry), "utf8")),
      ),
      options: {},
      // Un PDF cuesta más que su texto; se estima por lo alto.
      inputChars: data.byteLength / 4,
    });
  }
  return cases;
}

type PriceTable = Map<string, { input: number; output: number }>;
type Gateway = ReturnType<typeof createGateway>;

async function loadPrices(gateway: Gateway): Promise<PriceTable> {
  const { models } = await gateway.getAvailableModels();
  return new Map(
    models
      .filter((model) => model.pricing)
      .map((model) => [
        model.id,
        {
          input: Number(model.pricing!.input),
          output: Number(model.pricing!.output),
        },
      ]),
  );
}

function estimateCallUsd(prices: PriceTable, model: string, inputChars: number) {
  const price = prices.get(model);
  if (!price) throw new Error(`Sin precio en la Gateway para ${model}`);
  const promptChars =
    buildInstructions(null).length +
    JSON.stringify(z.toJSONSchema(InvoiceExtractionSchema)).length;
  const inputTokens = (promptChars + inputChars) / CHARS_PER_TOKEN;
  return inputTokens * price.input + OUTPUT_TOKENS_PER_INVOICE * price.output;
}

const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
const usd = (value: number) => `${value.toFixed(4)} $`;

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv.slice(2));
  const golden = existsSync(join(options.folder, "fichas"));
  const cases = (golden ? await loadGoldenDir(options.folder, options.redacted) : await loadPairs(options.folder)).slice(
    0,
    options.limit,
  );
  console.log(
    `${cases.length} facturas en ${options.folder} (${golden ? "texto anonimizado" : "documento"})`,
  );
  if (cases.length === 0) return;

  const gateway = createGateway({ apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY });
  const prices = await loadPrices(gateway);
  const configurations = options.models.map((model) => ({ label: model, models: [model] }));
  if (options.cascade) configurations.push({ label: "cascada", models: options.models });

  // Estimación: la cascada se cuenta como si siempre llegara al último modelo.
  let estimatedTotal = 0;
  for (const { label, models } of configurations) {
    const estimate = cases.reduce(
      (sum, goldenCase) =>
        sum +
        models.reduce(
          (modelSum, model) => modelSum + estimateCallUsd(prices, model, goldenCase.inputChars),
          0,
        ),
      0,
    );
    estimatedTotal += estimate;
    console.log(`  previsto ${label}: ${usd(estimate)}`);
  }
  console.log(`Previsto en total: ${usd(estimatedTotal)} · tope: ${usd(options.maxUsd)}\n`);
  if (options.estimateOnly) return;

  // El gasto real sale del saldo de la Gateway: el uso que devuelve cada
  // llamada no incluye todo lo que se factura (en el piloto se quedó un 20 %
  // corto). Se usa el mayor de los dos para no pasarse del tope.
  const balance = async () => Number((await gateway.getCredits()).balance);
  const startBalance = await balance();
  let tracked = 0;
  let spent = 0;
  const reports = [];

  for (const { label, models } of configurations) {
    const evaluations: InvoiceEvaluation[] = [];
    const spentAtStart = spent;
    let failures = 0;
    let stoppedByBudget = false;

    for (const goldenCase of cases) {
      const worstCase = models.reduce(
        (sum, model) => sum + estimateCallUsd(prices, model, goldenCase.inputChars),
        0,
      );
      if (spent + worstCase > options.maxUsd) {
        stoppedByBudget = true;
        break;
      }

      if (evaluations.length + failures > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }

      try {
        const result = await extractInvoice({
          file: goldenCase.file,
          context: { tenantSlug: "eval", jobType: "invoice_extraction", subjectId: goldenCase.name },
          knownCups: goldenCase.options.localCups ?? null,
          models,
        });
        const cost = result.attempts.reduce((sum, attempt) => {
          if (attempt.costUsd !== null) return sum + attempt.costUsd;
          const price = prices.get(attempt.model);
          return (
            sum +
            (attempt.inputTokens ?? 0) * (price?.input ?? 0) +
            (attempt.outputTokens ?? 0) * (price?.output ?? 0)
          );
        }, 0);
        tracked += cost;
        spent = Math.max(tracked, startBalance - (await balance()));
        const evaluation = evaluateExtraction(
          goldenCase.name,
          goldenCase.expected,
          result.extraction,
          goldenCase.options,
        );
        evaluations.push(evaluation);

        // Cada extracción se guarda para analizarla sin volver a pagarla.
        if (golden) {
          const dir = join(options.folder, "eval", label.replace(/[^\w.-]/g, "_"));
          await mkdir(dir, { recursive: true });
          await writeFile(
            join(dir, `${goldenCase.name}.json`),
            JSON.stringify({ evaluation, issues: result.issues, attempts: result.attempts, extraction: result.extraction }, null, 2),
          );
        }
      } catch (error) {
        failures += 1;
        console.error(`[${label}] ${goldenCase.name}: ${(error as Error).message}`);
      }
    }

    const summary = summarizeEvaluations(evaluations);
    const configSpent = spent - spentAtStart;
    reports.push({ label, models, failures, costUsd: configSpent, stoppedByBudget, summary, evaluations });

    console.log(`== ${label}`);
    console.log(`  Evaluadas: ${evaluations.length} · fallos de llamada: ${failures}`);
    console.log(`  Sin corrección: ${percent(summary.cleanRate)} · a revisión: ${percent(summary.flaggedRate)}`);
    console.log(`  Errores silenciosos: ${summary.silentErrors}`);
    console.log(`  Coste: ${usd(configSpent)}`);
    const weak = Object.entries(summary.fieldAccuracy)
      .filter(([, accuracy]) => accuracy < 1)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 6);
    if (weak.length) {
      console.log(`  Campos más flojos: ${weak.map(([f, a]) => `${f} ${percent(a)}`).join(", ")}`);
    }
    if (stoppedByBudget) console.log("  Parado por el tope de gasto.");
    console.log("");
    if (stoppedByBudget) break;
  }

  // El saldo tarda unos segundos en reflejar las últimas llamadas.
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const finalSpent = Math.max(tracked, startBalance - (await balance()));
  console.log(`Gastado en total: ${usd(finalSpent)} (saldo de la Gateway; el uso de las llamadas suma ${usd(tracked)})`);
  if (options.out) {
    await writeFile(options.out, JSON.stringify(reports, null, 2));
    console.log(`Informe completo en ${options.out}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
