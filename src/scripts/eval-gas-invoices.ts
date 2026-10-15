/**
 * Banco de evaluación de la lectura de facturas de gas.
 *
 *   pnpm eval:gas [--limit N] [--only a,b] [--max-usd 0.25] [--estimate] [--delay-ms 2000]
 *
 * Lee el texto anonimizado de `~/negoco-golden/gas` (pnpm golden:export
 * --energy gas) con la cascada de producción y el CUPS leído en local. Aún no
 * hay fichas verificadas: mide si la lectura cuadra sola (sin incidencias que
 * bloqueen) y si las cifras clave aparecen en el texto. Cada lectura se
 * guarda en `eval/cascada/` para revisarla sin volver a pagarla.
 *
 * Gasto: siempre con tope (--max-usd, 0,25 $ por defecto), medido con el
 * saldo de la Gateway antes y después.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createGateway } from "ai";
import { z } from "zod";
import { getInvoiceExtractionModels } from "@/comparador/ai/models";
import { extractGasInvoice, GAS_INSTRUCTIONS } from "@/comparador/gas/extract";
import { GasInvoiceExtractionSchema } from "@/comparador/gas/invoice-schema";
import { appearsInText, numbersInText } from "@/comparador/rates/normalize";
import { loadLocalEnv, readOption } from "./golden/paths";

const ROOT = join(homedir(), "negoco-golden", "gas");
const CHARS_PER_TOKEN = 3;
const OUTPUT_TOKENS = 2_000;

const usd = (value: number) => `${value.toFixed(4)} $`;

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const maxUsd = Number(readOption(argv, "--max-usd") ?? 0.25);
  const limit = Number(readOption(argv, "--limit") ?? Infinity);
  const only = readOption(argv, "--only")?.split(",").filter(Boolean);
  const delayMs = Number(readOption(argv, "--delay-ms") ?? 2_000);
  const models = readOption(argv, "--models")?.split(",").filter(Boolean) ?? [...getInvoiceExtractionModels()];

  const ids = (await readdir(join(ROOT, "redacted")))
    .filter((file) => file.endsWith(".txt"))
    .map((file) => file.slice(0, -4))
    .filter((id) => !only || only.includes(id))
    .sort()
    .slice(0, limit);
  const cases = await Promise.all(
    ids.map(async (id) => ({
      id,
      text: await readFile(join(ROOT, "redacted", `${id}.txt`), "utf8"),
      cups: (JSON.parse(await readFile(join(ROOT, "private", `${id}.json`), "utf8")) as { cups: string[] }).cups[0] ?? null,
    })),
  );

  const gateway = createGateway({ apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY });
  const { models: available } = await gateway.getAvailableModels();
  const prices = new Map(available.filter((model) => model.pricing).map((model) => [model.id, { input: Number(model.pricing!.input), output: Number(model.pricing!.output) }]));
  const promptChars = GAS_INSTRUCTIONS.length + JSON.stringify(z.toJSONSchema(GasInvoiceExtractionSchema)).length;
  /** Lo peor: la cascada entera. */
  const worstCase = (chars: number) =>
    models.reduce((sum, model) => {
      const price = prices.get(model);
      if (!price) throw new Error(`Sin precio en la Gateway para ${model}`);
      return sum + ((promptChars + chars) / CHARS_PER_TOKEN) * price.input + OUTPUT_TOKENS * price.output;
    }, 0);
  const estimate = cases.reduce((sum, { text }) => sum + worstCase(text.length), 0);
  console.log(`${cases.length} facturas de gas · previsto como mucho ${usd(estimate)} · tope ${usd(maxUsd)}`);
  if (argv.includes("--estimate")) return;

  const balance = async () => Number((await gateway.getCredits()).balance);
  const start = await balance();
  let spent = 0;
  let tracked = 0;
  const outDir = join(ROOT, "eval", "cascada");
  await mkdir(outDir, { recursive: true });
  const rows: { id: string; ok: boolean; model: string; blocking: string[]; missingInText: string[] }[] = [];

  for (const [index, item] of cases.entries()) {
    if (spent + worstCase(item.text.length) > maxUsd) {
      console.log("Parado por el tope de gasto.");
      break;
    }
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const result = await extractGasInvoice({
        file: { text: item.text },
        context: { tenantSlug: "eval", jobType: "invoice_extraction", subjectId: `gas-${item.id}` },
        knownCups: item.cups,
        models,
      });
      tracked += result.attempts.reduce((sum, attempt) => sum + (attempt.costUsd ?? 0), 0);
      spent = Math.max(tracked, start - (await balance()));
      const gas = result.extraction.gas;
      // Las cifras que deciden el cálculo tienen que estar en la factura.
      const numbers = numbersInText(item.text);
      const keys: [string, number | null | undefined][] = [
        ["consumptionKwh", gas.consumptionKwh],
        ["total", gas.total],
        ...gas.energyLines.map((line, at): [string, number] => [`energyLines[${at}].pricePerKwh`, line.pricePerKwh]),
        ...gas.fixedTermLines.map((line, at): [string, number] => [`fixedTermLines[${at}].amount`, line.amount]),
        ["hydrocarbonTax.amount", gas.hydrocarbonTax?.amount],
      ];
      const missingInText = keys
        .filter(([, value]) => typeof value === "number" && value !== 0 && !appearsInText(value, numbers, item.text))
        .map(([field, value]) => `${field}=${value}`);
      const blocking = result.issues.filter(({ severity }) => severity !== "warning").map(({ code, field }) => `${code}:${field}`);
      const model = result.attempts.at(-1)?.model ?? "?";
      rows.push({ id: item.id, ok: result.status === "ok", model, blocking, missingInText });
      await writeFile(join(outDir, `${item.id}.json`), JSON.stringify({ status: result.status, issues: result.issues, attempts: result.attempts, missingInText, extraction: result.extraction }, null, 2));
      console.log(`${item.id} ${result.status === "ok" ? "cuadra" : "REVISAR"} · ${result.attempts.map(({ model: used }) => used.split("/")[1]).join(" → ")}${blocking.length ? ` · ${blocking.join(", ")}` : ""}${missingInText.length ? ` · no está en el texto: ${missingInText.join(", ")}` : ""}`);
    } catch (error) {
      console.error(`${item.id}: ${(error as Error).message}`);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const finalSpent = Math.max(tracked, start - (await balance()));
  const ok = rows.filter(({ ok: clean }) => clean).length;
  const first = rows.filter(({ ok: clean, model }) => clean && model === models[0]).length;
  console.log(`\nCuadran ${ok} de ${rows.length} (${first} con el primer modelo) · con cifras que no están en el texto: ${rows.filter(({ missingInText }) => missingInText.length).length}`);
  console.log(`Gastado: ${usd(finalSpent)} (saldo de la Gateway; uso de las llamadas ${usd(tracked)})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
