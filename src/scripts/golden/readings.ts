import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { InvoiceExtractionSchema, type InvoiceExtraction } from "@/comparador/extraction/invoice-schema";

/**
 * Otras lecturas de la misma factura, de otro modelo: las de las mediciones
 * (`eval/cuadre-*.json`) y las fichas anteriores apartadas (`fichas-gpt5/`).
 * Sirven para dar por verificado un campo en el que dos modelos coinciden.
 */
export function loadOtherReadings(root: string, id: string): InvoiceExtraction[] {
  const readings: unknown[] = [];
  const aside = join(root, "fichas-gpt5");
  if (existsSync(aside)) {
    for (const file of readdirSync(aside).filter((name) => name.startsWith(id) && name.endsWith(".json"))) {
      readings.push(JSON.parse(readFileSync(join(aside, file), "utf8")));
    }
  }
  const evalDir = join(root, "eval");
  if (existsSync(evalDir)) {
    for (const file of readdirSync(evalDir).filter((name) => name.startsWith("cuadre-") && name.endsWith(".json"))) {
      const report = JSON.parse(readFileSync(join(evalDir, file), "utf8")) as { results?: { id: string; extraction: unknown }[] };
      const result = report.results?.find((entry) => entry.id === id);
      if (result) readings.push(result.extraction);
    }
  }
  return readings.flatMap((reading) => {
    const parsed = InvoiceExtractionSchema.safeParse(reading);
    return parsed.success ? [parsed.data] : [];
  });
}
