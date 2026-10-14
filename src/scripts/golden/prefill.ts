/**
 * Prepara la ficha de las facturas del banco que aún no tienen: la lee el
 * modelo más fuerte de la cascada con las mismas reglas que producción.
 * Después, `golden:sips` y la página de revisión marcan lo que cuadra solo;
 * una persona confirma el resto.
 *
 *   pnpm golden:prefill [--dir <carpeta>] [--model openai/gpt-5] [--max-usd 1]
 *
 * Solo envía el texto anonimizado. Nunca sobrescribe una ficha.
 */
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extractInvoice } from "@/comparador/extraction/extract-invoice";
import { DEFAULT_GOLDEN_DIR, goldenPath, loadLocalEnv, readOption } from "./paths";

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const root = readOption(argv, "--dir") ?? DEFAULT_GOLDEN_DIR;
  const model = readOption(argv, "--model") ?? "openai/gpt-5";
  const maxUsd = Number(readOption(argv, "--max-usd") ?? 1);

  const ids = (await readdir(goldenPath(root, "redacted", "")))
    .filter((file) => file.endsWith(".txt"))
    .map((file) => file.slice(0, -4))
    .filter((id) => existsSync(goldenPath(root, "originals", `${id}.pdf`)))
    .filter((id) => !existsSync(goldenPath(root, "fichas", `${id}.json`)))
    .sort();
  console.log(`${ids.length} facturas sin ficha · ${model} · tope ${maxUsd} $`);

  let spent = 0;
  let written = 0;
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
        context: { tenantSlug: "eval", jobType: "invoice_extraction", subjectId: `ficha-${id}` },
        knownCups: cups[0] ?? null,
        models: [model],
      });
      spent += result.attempts.reduce((sum, attempt) => sum + (attempt.costUsd ?? 0), 0);
      await writeFile(goldenPath(root, "fichas", `${id}.json`), JSON.stringify(result.extraction, null, 2));
      written += 1;
      const blocking = result.issues.filter(({ severity }) => severity === "blocking").map(({ code }) => code);
      console.log(`${id} ${result.status}${blocking.length ? ` · ${[...new Set(blocking)].join(", ")}` : ""}`);
    } catch (error) {
      console.error(`${id}: ${(error as Error).message}`);
    }
  }
  console.log(`Fichas nuevas: ${written} · coste ${spent.toFixed(4)} $`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
