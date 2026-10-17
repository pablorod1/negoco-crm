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
  gasTollsIncluded: null,
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
  const generate = vi.fn(async () => {
    const output = outputs.shift();
    if (output instanceof Error) throw output;
    return {
    output,
    model: "fake",
    usage: { inputTokens: 100, outputTokens: 100 },
    costUsd: 0.001,
    };
  });
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

  test("a 2.0TD indexed product is kept without energy, with the commissions of 2.0TD", async () => {
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
    if (result.status === "out_of_scope") throw new Error("unexpected");
    expect(result.proposed).toHaveLength(1);
    expect(result.proposed[0]).toMatchObject({ pricing: "indexed", energy: null });
    // Sin precio de energía que comprobar: solo cuenta la comisión, que el texto no trae.
    expect(result.issues.map(({ code }) => code).sort()).toEqual(["commission_not_in_source", "missing_valid_from"]);
  });

  test("the email body guides the reading and can give the start date", async () => {
    const note = "Os paso el anexo de Quimera. Precios válidos desde el 1 de noviembre de 2026.";
    const output = { ...extraction([unicornio]), validFrom: "2026-11-01" };

    const generate = fakeGenerate([classification(), output]);
    const result = await extractRateDocument({ document, context, generate, models: ["a"], emailNote: note });
    if (result.status === "out_of_scope") throw new Error("unexpected");
    expect(result.extraction.validFrom).toBe("2026-11-01");
    const call = generate.mock.calls[1] as unknown as [Parameters<typeof generateStructured>[0]];
    expect(call[0].instructions).toContain("mensaje del correo");
    expect(JSON.stringify(call[0].messages)).toContain("válidos desde el 1 de noviembre");

    // Sin el correo, una fecha que el documento no trae no vale.
    const alone = await extractRateDocument({
      document,
      context,
      generate: fakeGenerate([classification(), { ...output }]),
      models: ["a"],
    });
    if (alone.status === "out_of_scope") throw new Error("unexpected");
    expect(alone.extraction.validFrom).toBeNull();
  });

  test("an image that is not an annex (an email signature) is discarded without review", async () => {
    const image: PreparedDocument = { format: "image", text: null, parts: [], sentChars: 0, pages: null };
    const signature = { ...extraction([]), supplierName: "Beenergy", documentKind: "other" as const, validFrom: null, skipped: ["document is a business card"] };
    const result = await extractRateDocument({ document: image, context, generate: fakeGenerate([signature]), models: ["a"] });
    expect(result).toMatchObject({ status: "out_of_scope", reason: expect.stringContaining("No es un anexo") });

    // Una imagen de precios que no se ha podido leer sigue yendo a revisión.
    const unread = await extractRateDocument({
      document: image,
      context,
      generate: fakeGenerate([{ ...extraction([]), documentKind: "prices" as const }]),
      models: ["a"],
    });
    expect(unread.status).toBe("needs_review");
  });

  test("in an image, a date that is not in the file name or the email is dropped", async () => {
    const image: PreparedDocument = { format: "image", text: null, parts: [], sentChars: 0, pages: null };
    const read = (validFrom: string) => extractRateDocument({
      document: image,
      context,
      generate: fakeGenerate([{ ...extraction([unicornio]), validFrom }]),
      models: ["a"],
      fileName: "captacion-5-octubre-2026 (1).png",
    });
    // La IA se inventó el 01/01/2023 en el aviso de Gana del 5 de octubre de 2026.
    const invented = await read("2023-01-01");
    if (invented.status === "out_of_scope") throw new Error("unexpected");
    expect(invented.extraction.validFrom).toBeNull();
    const fromName = await read("2026-10-05");
    if (fromName.status === "out_of_scope") throw new Error("unexpected");
    expect(fromName.extraction.validFrom).toBe("2026-10-05");
  });
});
