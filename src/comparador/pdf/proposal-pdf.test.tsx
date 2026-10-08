// @vitest-environment node
import { describe, expect, test } from "vitest";
import type { CostBreakdown } from "@/comparador/engine/types";
import type { ProposalDocument } from "@/comparador/study/proposals";
import { brandColor } from "./branding";
import { renderProposalPdf } from "./proposal-pdf";

const cost = (total: number): CostBreakdown => ({
  days: 365,
  power: { P1: 60, P2: 10, total: 70 },
  energy: { P1: 100, P2: 80, P3: 60, total: 240 },
  energyDiscounts: [-12],
  otherElectricity: 0,
  socialBonus: 9,
  electricitySubtotal: 319,
  electricityTax: 16,
  meterRental: 9.7,
  services: 0,
  taxableBase: 344.7,
  vat: 72.39,
  vatExempt: 0,
  total,
});

const document: ProposalDocument = {
  version: 1,
  number: 1,
  generatedAt: "2026-10-08T10:00:00.000Z",
  priceDate: "2026-10-08",
  client: { name: "Cliente", cups: null },
  supply: {
    contractedKw: { P1: 3.3, P2: 3.3 },
    annualKwh: { P1: 900, P2: 900, P3: 1200 },
    consumptionSource: "invoice",
    sipsMonths: null,
    territory: "peninsula",
    power: { status: "oversized", maxDemandKw: 2.1, suggestedKw: 2.3 },
  },
  current: null,
  offer: {
    comercializadoraName: "Eleia",
    productName: "TRADERPOOL 3",
    termMonths: null,
    powerMode: "regulated",
    discounts: ["10 % en energía"],
    prices: { power: { P1: 0.08, P2: 0.01 }, energy: { P1: 0.15, P2: 0.08, P3: 0.05 } },
    cost: cost(480),
  },
  savings: null,
};

describe("proposal pdf", () => {
  test("renders a PDF with the font embedded, also without today's costs", async () => {
    const pdf = await renderProposalPdf(document, { displayName: "Negoco Cloud", logo: null, color: "#2563eb" });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toMatch(/Inter-Regular/);
  });

  test("brand colors the PDF cannot read fall back to blue", () => {
    expect(brandColor({ palette: { primary: { "600": "#0f766e" } } })).toBe("#0f766e");
    expect(brandColor({ palette: { primary: { "600": "oklch(0.6 0.1 200)" } } })).toBe("#2563eb");
    expect(brandColor({ palette: {} })).toBe("#2563eb");
  });
});
