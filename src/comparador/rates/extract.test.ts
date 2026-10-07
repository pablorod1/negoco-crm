import { describe, expect, test, vi } from "vitest";
import type { generateStructured } from "@/comparador/ai/gateway";
import type { PreparedDocument } from "./document";
import { extractRateDocument } from "./extract";
import type { ExtractedRate, RateDocumentClassification, RateDocumentExtraction } from "./schema";

const TEXT = `ANEXO DE PRECIOS UNICORNIO
TARIFA 2.0TD P1 P2 P3
Energía (€/kWh) con SS.AA. 0,24755 0,17927 0,15329
Potencia pers. (€/kW día) 0,08960 0,07048`;

const document: PreparedDocument = {
  format: "text",
  text: TEXT,
  parts: [{ type: "text", text: TEXT }],
  sentChars: TEXT.length,
  pages: null,
};

const unicornio: ExtractedRate = {
  productName: "Unicornio",
  accessTariff: "2.0TD",
  pricing: "fixed",
  level: null,
  territory: null,
  channel: null,
  segment: null,
  minKw: null,
  maxKw: null,
  minKwh: null,
  maxKwh: null,
  startFrom: null,
  startTo: null,
  months: null,
  powerMode: "fixed",
  powerUnit: "eur_kw_day",
  powerP1: 0.0896,
  powerP2: 0.07048,
  powerMargin: null,
  energyUnit: "eur_kwh",
  energyP1: 0.24755,
  energyP2: 0.17927,
  energyP3: 0.15329,
  singlePrice: false,
  ancillaryIncluded: true,
  feeMinMwh: null,
  feeMaxMwh: null,
  feeOnPower: false,
  discounts: [],
};

function extraction(rates: ExtractedRate[]): RateDocumentExtraction {
  return {
    supplierName: "Quimera",
    documentKind: "prices",
    validFrom: "2026-10-01",
    validTo: null,
    partialUpdate: false,
    rates,
    commissions: [],
    skipped: [],
  };
}

const classification = (overrides: Partial<RateDocumentClassification> = {}): RateDocumentClassification => ({
  supplierName: "Quimera",
  hasPrices: true,
  hasCommissions: false,
  accessTariffs: ["2.0TD"],
  pricing: ["fixed"],
  ...overrides,
});

/** Generador falso: la primera llamada es la clasificación; después, las extracciones. */
function fakeGenerate(outputs: unknown[]) {
  const generate = vi.fn(async () => ({
    output: outputs.shift(),
    model: "fake",
    usage: { inputTokens: 100, outputTokens: 100 },
    costUsd: 0.001,
  }));
  return generate as unknown as typeof generateStructured & typeof generate;
}

const context = { tenantSlug: "test", jobType: "rate_extraction" as const };

describe("extractRateDocument", () => {
  test("documents without 2.0TD are discarded before extracting", async () => {
    const generate = fakeGenerate([classification({ accessTariffs: ["3.0TD", "6.1TD"] })]);
    const result = await extractRateDocument({ document, context, generate, models: ["a", "b"] });
    expect(result.status).toBe("out_of_scope");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("the classifier's idea of pricing does not discard anything", async () => {
    // El modelo barato vio la revisión por IPC de Endesa como un indexado.
    const generate = fakeGenerate([
      classification({ pricing: ["flat", "indexed"] }),
      extraction([unicornio]),
    ]);
    const result = await extractRateDocument({ document, context, generate, models: ["a"] });
    expect(result.status).toBe("ok");
  });

  test("a figure that is not in the document goes to the stronger model", async () => {
    const generate = fakeGenerate([
      classification(),
      extraction([{ ...unicornio, energyP1: 0.24775 }]),
      extraction([unicornio]),
    ]);
    const result = await extractRateDocument({ document, context, generate, models: ["a", "b"] });
    expect(result.status).toBe("ok");
    if (result.status === "out_of_scope") throw new Error("unexpected");
    expect(result.attempts.map(({ model }) => model)).toEqual(["a", "b"]);
    expect(result.costUsd).toBeCloseTo(0.003, 6);
  });

  test("nothing fixed for 2.0TD is out of scope, without paying the stronger model", async () => {
    // El preciario de APOLO: 2.0TD solo indexada y la comisión «65 % del fee»
    // de las secciones de 3.0TD, 6.1TD e indexados.
    const generate = fakeGenerate([
      classification({ hasCommissions: true }),
      {
        ...extraction([{ ...unicornio, pricing: "indexed" }]),
        commissions: [
          { productName: null, accessTariff: "3.0TD", pricing: "fixed", level: null, channel: null, minKwh: null, maxKwh: null, ruleType: "fee_share", feeBase: "energy", amount: 65 },
          { productName: null, accessTariff: null, pricing: null, level: null, channel: null, minKwh: null, maxKwh: null, ruleType: "fee_share", feeBase: "power", amount: 50 },
        ],
      },
    ]);
    const result = await extractRateDocument({ document, context, generate, models: ["a", "b"] });
    expect(result.status).toBe("out_of_scope");
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
