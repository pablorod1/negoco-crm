// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { toStudyExtraction } from "@/comparador/gas/invoice";
import type { GasInvoiceExtraction } from "@/comparador/gas/invoice-schema";

const GAS_TEXT = `Factura de gas natural Nº factura G-1 Total factura 194,43 €
Peaje de acceso RL.2 Consumo 112 m3 x 11,018 kWh/m3 = 1.234 kWh
Impuesto especial sobre hidrocarburos 1.234 kWh x 0,00234 €/kWh = 2,89 €`;

vi.mock("./read-invoice", () => ({
  photoVisionEnabled: () => false,
  invoiceImagesForVision: vi.fn(),
  zoomedBands: vi.fn(),
  readInvoice: vi.fn(async () => ({ text: GAS_TEXT, fromImage: false })),
}));

import { analyzeInvoice, StudyError, type SipsFetcher } from "./service";

const CUPS = "ES0230901000012345JM";

const reading: GasInvoiceExtraction = {
  supplierName: "Gana Energía",
  invoiceNumber: "G-1",
  issueDate: "2026-10-05",
  billingPeriod: { from: "2026-08-01", to: "2026-09-30", days: 61 },
  cups: CUPS,
  holder: { name: null, taxId: null },
  supplyAddress: null,
  accessTariff: "RL.2",
  regulatedTur: false,
  pricing: "fixed",
  consumptionKwh: 1234,
  consumptionM3: null,
  conversionFactor: null,
  fixedTermLines: [{ days: 61, pricePerDay: 0.3, originalPrice: null, amount: 18.3 }],
  energyLines: [{ kwh: 1234, pricePerKwh: 0.075, amount: 92.55 }],
  discounts: [],
  hydrocarbonTax: { kwh: 1234, ratePerKwh: 0.00234, amount: 2.89 },
  meterRental: null,
  regulatedLines: [],
  otherTaxableLines: [],
  oneOffLines: [],
  vatExemptLines: [],
  taxableBase: 113.74,
  vatLines: [{ ratePercent: 21, base: 113.74, amount: 23.89 }],
  total: 137.63,
};

const year = [
  ["2025-10-01", "2025-11-30", 1500],
  ["2025-12-01", "2026-01-31", 3500],
  ["2026-02-01", "2026-03-31", 2500],
  ["2026-04-01", "2026-05-31", 900],
  ["2026-06-01", "2026-07-31", 300],
  ["2026-08-01", "2026-09-30", 300],
].map(([from, to, kwh]) => ({ fechaInicioMesConsumo: from, fechaFinMesConsumo: to, consumoEnWhP1: Number(kwh) * 1000, consumoEnWhP2: 0 }));

describe("analizar una factura de gas", () => {
  test("pregunta al SIPS de gas, lee con el extractor de gas y guarda un suministro de gas", async () => {
    const fetchSips = vi.fn<SipsFetcher>(async (_cups, procedure) =>
      procedure === "PS"
        ? ({ rows: [{ codigoPeajeEnVigor: "RL2", codigoProvinciaPS: "28", derechoTUR: "N" }], hasData: true } as never)
        : ({ rows: year, hasData: true } as never),
    );
    const extractGas = vi.fn(async () => ({ status: "ok" as const, extraction: toStudyExtraction(reading), issues: [], attempts: [{ model: "m", issues: [], costUsd: 0.002, inputTokens: null, outputTokens: null, usedSupplierHint: false }] }));
    const extract = vi.fn();
    const execute = vi.fn(async () => ({ rows: [], rowsAffected: 1 }));
    await analyzeInvoice({
      client: { execute, batch: vi.fn() } as never,
      tenantSlug: "test",
      comparativaId: "CMP-1",
      userId: "user-1",
      invoice: { data: new Uint8Array(), fileName: "gas.pdf", fileId: null, mime: "application/pdf", cups: CUPS },
      channel: "acquisition",
      today: "2026-10-15",
      fetchSips,
      energy: "gas",
      extract: extract as never,
      extractGas: extractGas as never,
      verify: vi.fn(async () => null),
    });
    expect(fetchSips).toHaveBeenCalledWith(CUPS, "CONSUMOS", "GAS");
    expect(extract).not.toHaveBeenCalled();
    const insert = (execute.mock.calls as unknown as [{ sql: string; args: unknown[] }][]).find(([statement]) => statement.sql.includes("INSERT INTO comparison_studies"));
    const supply = JSON.parse(String(insert![0].args[8]));
    expect(supply.energy).toBe("gas");
    expect(supply.gas).toMatchObject({ accessTariff: "RL.2", turEligible: false });
    expect(supply.annualKwh.P1).toBe(9000);
  });

  test("una factura de luz en una comparativa de gas se para antes de gastar en la IA", async () => {
    const { readInvoice } = await import("./read-invoice");
    vi.mocked(readInvoice).mockResolvedValueOnce({ text: "Nº factura F-1 Total factura 44,07 € Peaje de acceso: 2.0TD Potencia contratada 3,45 kW", fromImage: false } as never);
    const extractGas = vi.fn();
    const error = await analyzeInvoice({
      client: { execute: vi.fn(), batch: vi.fn() } as never,
      tenantSlug: "test",
      comparativaId: "CMP-1",
      userId: "user-1",
      invoice: { data: new Uint8Array(), fileName: "luz.pdf", fileId: null, mime: "application/pdf", cups: CUPS },
      channel: "acquisition",
      today: "2026-10-15",
      fetchSips: vi.fn(),
      energy: "gas",
      extractGas: extractGas as never,
    }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(StudyError);
    expect((error as StudyError).message).toMatch(/factura de luz/);
    // Se puede pasar la comparativa a luz en la misma pantalla.
    expect((error as StudyError).code).toBe("other_energy");
    expect(extractGas).not.toHaveBeenCalled();
  });
});

describe("consumo estimado con la factura", () => {
  const run = (rows: unknown[], useSips: boolean) => {
    const fetchSips = vi.fn<SipsFetcher>(async (_cups, procedure) =>
      procedure === "PS" ? ({ rows: [{ codigoPeajeEnVigor: "R2", codigoProvinciaPS: "28" }], hasData: true } as never) : ({ rows, hasData: true } as never),
    );
    const execute = vi.fn(async () => ({ rows: [], rowsAffected: 1 }));
    const done = analyzeInvoice({
      client: { execute, batch: vi.fn() } as never,
      tenantSlug: "test",
      comparativaId: "CMP-1",
      userId: "user-1",
      invoice: { data: new Uint8Array(), fileName: "gas.pdf", fileId: null, mime: "application/pdf", cups: CUPS },
      channel: "acquisition",
      today: "2026-10-15",
      fetchSips,
      energy: "gas",
      useSips,
      extractGas: vi.fn(async () => ({ status: "ok" as const, extraction: toStudyExtraction(reading), issues: [], attempts: [] })) as never,
      verify: vi.fn(async () => null),
    });
    const saved = async () => {
      await done;
      const insert = (execute.mock.calls as unknown as [{ sql: string; args: unknown[] }][]).find(([statement]) => statement.sql.includes("INSERT INTO comparison_studies"));
      return { supply: JSON.parse(String(insert![0].args[8])), issues: JSON.parse(String(insert![0].args[7])) as { code: string }[] };
    };
    return { saved, fetchSips };
  };

  test("sin un año de SIPS (alta nueva) no se para: estima con la factura y lo avisa", async () => {
    const { saved } = run(year.slice(-2), true);
    const { supply, issues } = await saved();
    // 1.234 kWh en 61 días → 7.384 kWh al año.
    expect(supply.annualKwh.P1).toBe(7384);
    expect(supply.estimate).toEqual({ reason: "no_sips", invoiceDays: 61 });
    expect(supply.referenceAnnualKwh).toBeNull();
    expect(issues.map(({ code }) => code)).toContain("estimated_consumption");
  });

  test("«Estudio sin SIPS»: consumo de la factura, pero el SIPS de 12 meses manda en la comisión", async () => {
    const { saved, fetchSips } = run(year, false);
    const { supply } = await saved();
    expect(fetchSips).toHaveBeenCalledWith(CUPS, "CONSUMOS", "GAS");
    expect(supply.estimate.reason).toBe("chosen");
    expect(supply.annualKwh.P1).toBe(7384);
    expect(supply.referenceAnnualKwh).toBe(9000);
    expect(supply.gas.accessTariff).toBe("RL.2");
  });
});
