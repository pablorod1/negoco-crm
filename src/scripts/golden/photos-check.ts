/**
 * Mide las fotos de facturas sin fichas: cuántas cuadran solas (sin
 * incidencias que bloqueen el estudio) y qué incidencias salen.
 *
 *   pnpm golden:photos-check [--dir <carpeta>] [--models a,b] [--max-usd 0.10] [--out informe.json] [--images]
 *
 * Por defecto envía a la IA el texto anonimizado que dejó `golden:photos`.
 * Con --images envía las fotos enteras, con todos sus datos (decisión del
 * usuario, 14/10/2026), enderezadas y a 2048 px como mucho. Sin fichas no
 * detecta errores silenciosos: para eso hay que revisar fichas.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { join } from "node:path";
import { getInvoiceExtractionModels } from "@/comparador/ai/models";
import { extractInvoice, type InvoiceFile } from "@/comparador/extraction/extract-invoice";
import { goldenPath, loadLocalEnv, readOption } from "./paths";

async function main() {
  loadLocalEnv();
  const argv = process.argv.slice(2);
  const root = readOption(argv, "--dir") ?? join(process.env.HOME ?? "", "negoco-golden", "fotos");
  const models = readOption(argv, "--models")?.split(",").filter(Boolean) ?? [...getInvoiceExtractionModels()];
  const maxUsd = Number(readOption(argv, "--max-usd") ?? 0.1);
  const out = readOption(argv, "--out");
  const useImages = argv.includes("--images");
  const originals = useImages ? await readdir(goldenPath(root, "originals", "")) : [];

  /** Las fotos de una factura, en orden, como JPEG enderezado de 2048 px como mucho. */
  const photosOf = async (id: string): Promise<InvoiceFile> => {
    const files = originals
      .filter((name) => name.startsWith(`${id}-`))
      .sort((left, right) => Number(left.split("-")[1].split(".")[0]) - Number(right.split("-")[1].split(".")[0]));
    const pages = await Promise.all(
      files.map(async (name) => ({
        data: new Uint8Array(
          await sharp(await readFile(goldenPath(root, "originals", name)), { failOn: "none" })
            .rotate()
            .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer(),
        ),
        mediaType: "image/jpeg" as const,
      })),
    );
    return { pages };
  };

  // Con fichas, solo las facturas del banco (sin las excluidas ni descartadas).
  const withFichas = new Set(
    (await readdir(goldenPath(root, "fichas", "")).catch(() => [] as string[])).map((file) => file.slice(0, -5)),
  );
  const ids = (await readdir(goldenPath(root, "redacted", "")))
    .filter((file) => file.endsWith(".txt"))
    .map((file) => file.slice(0, -4))
    .filter((id) => withFichas.size === 0 || withFichas.has(id))
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
    const file: InvoiceFile = useImages
      ? await photosOf(id)
      : { text: await readFile(goldenPath(root, "redacted", `${id}.txt`), "utf8") };
    const { cups } = JSON.parse(await readFile(goldenPath(root, "private", `${id}.json`), "utf8")) as { cups: string[] };
    try {
      const result = await extractInvoice({
        file,
        context: { tenantSlug: "eval", jobType: "invoice_extraction", subjectId: `foto-${id}` },
        knownCups: cups[0] ?? null,
        models,
      });
      spent += result.attempts.reduce((sum, attempt) => sum + (attempt.costUsd ?? 0), 0);
      const last = result.attempts.at(-1)!.model;
      usedModels[last] = (usedModels[last] ?? 0) + 1;
      // CUPS tapado por la comercializadora («CUPS: *»): en producción se pide a
      // mano; no es un fallo de lectura.
      const meta = JSON.parse(await readFile(goldenPath(root, "meta", `${id}.json`), "utf8").catch(() => "{}")) as {
        cupsMasked?: boolean;
      };
      const issues = result.issues.filter(
        (issue) => !(meta.cupsMasked && issue.code === "missing_field" && issue.field === "cups"),
      );
      const status = issues.some(({ severity }) => severity === "blocking") ? "needs_review" : "ok";
      if (status === "ok") ok += 1;
      const codes = issues.filter(({ severity }) => severity !== "warning").map(({ code }) => code);
      for (const code of new Set(codes)) issueCounts[code] = (issueCounts[code] ?? 0) + 1;
      results.push({ id, status, issues, attempts: result.attempts, extraction: result.extraction });
      console.log(`${id} ${status} ${codes.join(", ")}`);
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
