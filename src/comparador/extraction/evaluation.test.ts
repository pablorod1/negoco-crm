import { describe, expect, test } from "vitest";
import { evaluateExtraction, summarizeEvaluations } from "./evaluation";
import { iberdrolaInvoice, naturgyInvoice } from "./fixtures";

describe("evaluateExtraction", () => {
  test("a perfect extraction is clean", () => {
    const evaluation = evaluateExtraction("n1", naturgyInvoice, naturgyInvoice);
    expect(evaluation).toMatchObject({
      clean: true,
      flagged: false,
      silentError: false,
      wrongFields: [],
    });
  });

  test("a misread caught by validation is flagged, not silent", () => {
    const evaluation = evaluateExtraction("n1", naturgyInvoice, {
      ...naturgyInvoice,
      total: 57.84,
    });
    expect(evaluation).toMatchObject({
      flagged: true,
      clean: false,
      silentError: false,
      wrongFields: ["total"],
    });
  });

  test("a wrong field that still adds up is a silent error", () => {
    // Consumo por periodo repartido mal: las líneas siguen cuadrando.
    const evaluation = evaluateExtraction("n1", naturgyInvoice, {
      ...naturgyInvoice,
      consumptionKwh: { P1: 110, P2: 95, P3: 162 },
    });
    expect(evaluation).toMatchObject({
      flagged: false,
      silentError: true,
      wrongFields: ["kwhP1", "kwhP2"],
    });
  });

  test("informative fields do not make an extraction unclean", () => {
    const evaluation = evaluateExtraction("n1", naturgyInvoice, {
      ...naturgyInvoice,
      supplierName: "Endesa Energía",
    });
    expect(evaluation.clean).toBe(true);
    expect(evaluation.wrongFields).toEqual(["supplierName"]);
  });
});

describe("summarizeEvaluations", () => {
  test("aggregates rates, silent errors and accuracy per field and supplier", () => {
    const summary = summarizeEvaluations([
      evaluateExtraction("n1", naturgyInvoice, naturgyInvoice),
      evaluateExtraction("n2", naturgyInvoice, { ...naturgyInvoice, total: 1 }),
      evaluateExtraction("i1", iberdrolaInvoice, iberdrolaInvoice),
      evaluateExtraction("i2", iberdrolaInvoice, {
        ...iberdrolaInvoice,
        consumptionKwh: { P1: 35, P2: 40, P3: 55 },
      }),
    ]);

    expect(summary).toMatchObject({
      invoices: 4,
      cleanRate: 0.5,
      flaggedRate: 0.25,
      silentErrors: 1,
      cleanRateBySupplier: {
        "Naturgy Iberia": 0.5,
        "Iberdrola Clientes": 0.5,
      },
    });
    expect(summary.fieldAccuracy.total).toBe(0.75);
    expect(summary.fieldAccuracy.kwhP1).toBe(0.75);
  });
});
