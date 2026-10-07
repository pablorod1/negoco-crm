import { describe, expect, test } from "vitest";
import { naturgyInvoice } from "@/comparador/extraction/fixtures";
import { computeFieldStatuses } from "./statuses";

const base = {
  ficha: naturgyInvoice,
  redactedText: "Peaje de acceso: 2.0TD\nTotal a pagar 75,84 €",
  supplierGuess: "Naturgy",
  privateCups: ["ES0021000000000001RK0F"],
  sips: null,
  confirmedFields: [] as string[],
};

describe("computeFieldStatuses", () => {
  test("arithmetic confirms amounts, prices, power and days", () => {
    const statuses = computeFieldStatuses(base);

    expect(statuses).toMatchObject({
      "powerLines.0": "verified",
      "energyLines.0": "verified",
      "socialBonusLines.0": "verified",
      meterRental: "verified",
      electricityTax: "verified",
      vat: "verified",
      total: "verified",
      "contractedKw.P1": "verified",
      "billingPeriod.days": "verified",
      "billingPeriod.dates": "verified",
      accessTariff: "verified",
      supplierName: "verified",
      pricing: "verified",
      cups: "verified",
    });
  });

  test("leaves for a person what only the reader saw", () => {
    const statuses = computeFieldStatuses(base);
    expect(statuses["consumptionKwh.P1"]).toBe("unverified");
    expect(statuses.issueDate).toBe("unverified");
  });

  test("SIPS confirms consumption per period", () => {
    const statuses = computeFieldStatuses({
      ...base,
      sips: {
        consumption: { P1: true, P2: true, P3: false },
        contractedPower: true,
      },
    });
    expect(statuses["consumptionKwh.P1"]).toBe("verified");
    expect(statuses["consumptionKwh.P3"]).toBe("unverified");
  });

  test("a misread line is an error and breaks trust in the rest", () => {
    const statuses = computeFieldStatuses({
      ...base,
      ficha: { ...naturgyInvoice, total: 57.84 },
    });
    expect(statuses.total).toBe("error");
    expect(statuses["powerLines.0"]).toBe("verified");

    const lineError = computeFieldStatuses({
      ...base,
      ficha: {
        ...naturgyInvoice,
        energyLines: [{ ...naturgyInvoice.energyLines[0], amount: 41.33 }],
      },
    });
    expect(lineError["energyLines.0"]).toBe("error");
    expect(lineError["powerLines.0"]).toBe("unverified");
  });

  test("a person's confirmation turns unverified fields into confirmed", () => {
    const statuses = computeFieldStatuses({
      ...base,
      confirmedFields: ["issueDate", "total"],
    });
    expect(statuses.issueDate).toBe("confirmed");
    expect(statuses.total).toBe("verified");
  });
});
