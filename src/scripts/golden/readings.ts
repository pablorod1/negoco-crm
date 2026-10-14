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

const JEV_FIELDS: Record<string, string> = {
  "consumo P1": "consumptionKwh.P1",
  "consumo P2": "consumptionKwh.P2",
  "consumo P3": "consumptionKwh.P3",
  días: "billingPeriod.days",
  "potencia P1": "contractedKw.P1",
  comercializadora: "supplierName",
  autoconsumo: "hasSelfConsumption",
};

/**
 * Campos de la ficha que Jev no ve en la factura (`eval/jev.json`, de
 * `golden:jev`): la lectura de Luna coincidía con la ficha y aun así quedó
 * por debajo de 0,5. Vuelven a revisión aunque otra comprobación los diera
 * por buenos.
 */
export function loadJevDoubts(root: string, id: string): string[] {
  const path = join(root, "eval", "jev.json");
  if (!existsSync(path)) return [];
  const report = JSON.parse(readFileSync(path, "utf8")) as {
    verification?: { id: string; field: string; expected: boolean; probability: number }[];
  };
  return (report.verification ?? [])
    .filter((entry) => entry.id === id && entry.expected && entry.probability < 0.5)
    .map((entry) => JEV_FIELDS[entry.field])
    .filter((field): field is string => Boolean(field));
}
