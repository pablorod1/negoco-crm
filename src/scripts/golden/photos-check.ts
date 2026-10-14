/**
 * Mide las fotos de facturas sin fichas: cuántas cuadran solas (sin
 * incidencias que bloqueen el estudio) y qué incidencias salen.
 *
 *   pnpm golden:photos-check [--dir <carpeta>] [--models a,b] [--max-usd 0.10] [--out informe.json]
 *
 * Solo envía a la IA el texto anonimizado que dejó `golden:photos`. Sin
 * fichas no detecta errores silenciosos: para eso hay que revisar fichas.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getInvoiceExtractionModels } from "@/comparador/ai/models";
import { extractInvoice } from "@/comparador/extraction/extract-invoice";
import { goldenPath, loadLocalEnv, readOption } from "./paths";

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const root = readOption(argv, "--dir") ?? join(process.env.HOME ?? "", "negoco-golden", "fotos");
  const models = readOption(argv, "--models")?.split(",").filter(Boolean) ?? [...getInvoiceExtractionModels()];
  const maxUsd = Number(readOption(argv, "--max-usd") ?? 0.1);
  const out = readOption(argv, "--out");

  const ids = (await readdir(goldenPath(root, "redacted", "")))
    .filter((file) => file.endsWith(".txt"))
    .map((file) => file.slice(0, -4))
    .sort();

  let spent = 0;
  let ok = 0;
  const issueCounts: Record<string, number> = {};
  const usedModels: Record<string, number> = {};
  const results = [];

  for (const id of ids) {
    if (spent >= maxUsd) {
      console.log("Parado por el tope de gasto.");
      break;
    }
    const text = await readFile(goldenPath(root, "redacted", `${id}.txt`), "utf8");
    const { cups } = JSON.parse(await readFile(goldenPath(root, "private", `${id}.json`), "utf8")) as { cups: string[] };
    try {
      const result = await extractInvoice({
        file: { text },
        context: { tenantSlug: "eval", jobType: "invoice_extraction", subjectId: `foto-${id}` },
        knownCups: cups[0] ?? null,
        models,
      });
      spent += result.attempts.reduce((sum, attempt) => sum + (attempt.costUsd ?? 0), 0);
      const last = result.attempts.at(-1)!.model;
      usedModels[last] = (usedModels[last] ?? 0) + 1;
      if (result.status === "ok") ok += 1;
      const codes = result.issues.filter(({ severity }) => severity !== "warning").map(({ code }) => code);
      for (const code of new Set(codes)) issueCounts[code] = (issueCounts[code] ?? 0) + 1;
      results.push({ id, status: result.status, issues: result.issues, attempts: result.attempts, extraction: result.extraction });
      console.log(`${id} ${result.status} ${codes.join(", ")}`);
    } catch (error) {
      console.error(`${id}: ${(error as Error).message}`);
    }
  }

  const total = results.length;
  console.log(`\nFotos: ${total} · cuadran solas: ${ok} (${((ok / Math.max(total, 1)) * 100).toFixed(1)} %)`);
  console.log("Modelo que dio la lectura final:", usedModels);
  console.log("Incidencias (facturas con cada una):", issueCounts);
  console.log(`Coste: ${spent.toFixed(4)} $`);
  if (out) await writeFile(out, JSON.stringify({ models, total, ok, issueCounts, usedModels, spent, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
