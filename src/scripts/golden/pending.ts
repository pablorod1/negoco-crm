/**
 * Cuánto queda por revisar en el banco: campos sin verificar o con error por
 * ficha y por campo. Todo en local, sin IA.
 *
 *   pnpm golden:pending [--dir <carpeta>]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { InvoiceExtractionSchema } from "@/comparador/extraction/invoice-schema";
import { DEFAULT_GOLDEN_DIR, goldenPath, readOption } from "./paths";
import { loadJevDoubts, loadOtherReadings } from "./readings";
import { computeFieldStatuses } from "./statuses";

const root = readOption(process.argv.slice(2), "--dir") ?? DEFAULT_GOLDEN_DIR;
const read = (path: string) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null);

const byField: Record<string, number> = {};
const totals: Record<string, number> = {};
let cases = 0;
let done = 0;
let withErrors = 0;
for (const file of readdirSync(goldenPath(root, "fichas", ""))) {
  const id = file.slice(0, -5);
  const ficha = InvoiceExtractionSchema.parse(read(goldenPath(root, "fichas", file)));
  const statuses = computeFieldStatuses({
    ficha,
    redactedText: readFileSync(goldenPath(root, "redacted", `${id}.txt`), "utf8"),
    supplierGuess: read(goldenPath(root, "meta", `${id}.json`))?.supplierGuess ?? "otra",
    privateCups: read(goldenPath(root, "private", `${id}.json`))?.cups ?? [],
    sips: read(goldenPath(root, "sips", `${id}.json`)),
    confirmedFields: read(goldenPath(root, "review", `${id}.json`))?.confirmedFields ?? [],
    otherReadings: loadOtherReadings(root, id),
    doubtful: loadJevDoubts(root, id),
  });
  cases += 1;
  const pending = Object.entries(statuses).filter(([, status]) => status === "unverified" || status === "error");
  if (pending.length === 0) done += 1;
  if (Object.values(statuses).includes("error")) withErrors += 1;
  for (const [field] of pending) byField[field] = (byField[field] ?? 0) + 1;
  for (const status of Object.values(statuses)) totals[status] = (totals[status] ?? 0) + 1;
}

const pendingFields = Object.values(byField).reduce((sum, value) => sum + value, 0);
console.log(`${cases} fichas · ${done} sin nada que revisar · ${withErrors} con errores · ${pendingFields} campos pendientes`);
console.log("Estados:", totals);
console.log("Campos más pendientes:", Object.entries(byField).sort((a, b) => b[1] - a[1]).slice(0, 12));
