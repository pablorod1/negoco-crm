import { describe, expect, test } from "vitest";
import { basePriceMarker, basePriceSheets, markBasePrices } from "./base-price";
import type { SheetGrid } from "./sheets/grid";
import type { ProposedRate } from "./types";

const grid = (name: string, texts: string[]): SheetGrid => ({ name, rows: texts.map((text) => [{ value: text, text }]) });

function row(overrides: Partial<ProposedRate>): ProposedRate {
  return {
    productName: "SIMPLEX", productKey: "simplex", accessTariff: "2.0TD", pricing: "fixed", level: null, territory: "peninsula",
    channel: null, clientSegment: null, minPowerKw: null, maxPowerKw: null, minAnnualKwh: null, maxAnnualKwh: null,
    supplyStartFrom: null, supplyStartTo: null, termMonths: null, powerMode: "fixed", powerMarginPerKwYear: null,
    power: { P1: 0.0759, P2: 0.002 }, energy: { P1: 0.27544, P2: 0.194963, P3: 0.164337 }, includesAncillaryServices: true,
    feeEnergyMinPerMwh: null, feeEnergyMaxPerMwh: null, feePowerAllowed: false, discounts: [], powerStated: true,
    sourceExcerpt: "Hoja «SIMPLEX», fila 14: D=2.0TD", sourceValues: {}, ...overrides,
  };
}

describe("base prices from the sheet text", () => {
  test("notes that say the prices are a base, and notes that do not", () => {
    expect(basePriceMarker("A estos precios base hay que incluirles el COE (Coste Operativo Eleia)")).toBe("precio base");
    expect(basePriceMarker("Del coste operativo Eleia (COE) te llevas el 70%")).toBe("COE (coste operativo)");
    expect(basePriceMarker("TARIFA FIJA BASE + FEE")).toBe("+ fee");
    expect(basePriceMarker("1,5 €/MWh (FEE MÍNIMO)")).toBe("fee mínimo");
    // Los peajes no son un fee; «precio fijo» tampoco es un precio base.
    expect(basePriceMarker("A estos precios hay que añadirle los cargos y peajes")).toBeNull();
    expect(basePriceMarker("PRECIO FIJO 12 MESES")).toBeNull();
  });

  test("a FEE column header marks the sheet; other sheets stay as they are", () => {
    const sheets = basePriceSheets([grid("PreciofijoMASMAX", ["Peaje", "FEE", "P1"]), grid("TU DECIDES", ["PRECIO FIJO", "INDEXADO"])]);
    expect([...sheets]).toEqual([["PreciofijoMASMAX", "columna FEE"]]);
  });

  test("fixed prices of a marked sheet admit the agency fee; without power, they take the regulated one", () => {
    const result = markBasePrices(
      {
        status: "needs_review" as const,
        issues: [{ severity: "blocking" as const, code: "missing_power" as const, message: "Base Pyme: sin potencia", rowKey: "x" }],
        proposed: [
          row({}),
          row({ productName: "Base Pyme", productKey: "basepyme", powerStated: false, power: null, sourceExcerpt: "Hoja «SIMPLEX», fila 15" }),
          row({ productName: "SIMPLEX INDEXADO", pricing: "indexed", sourceExcerpt: "Hoja «SIMPLEX», fila 16" }),
          row({ productName: "TU DECIDES", sourceExcerpt: "Hoja «TU DECIDES», fila 12" }),
        ],
      },
      new Map([["SIMPLEX", "precio base"]]),
    );
    expect(result.proposed.map(({ productName, feeEnergyMinPerMwh, powerMode }) => [productName, feeEnergyMinPerMwh, powerMode])).toEqual([
      ["SIMPLEX", 0, "fixed"],
      ["Base Pyme", 0, "regulated"],
      ["SIMPLEX INDEXADO", null, "fixed"],
      ["TU DECIDES", null, "fixed"],
    ]);
    expect(result.issues.map(({ code }) => code).filter((code) => code !== "missing_power")).toEqual(["base_price", "base_price", "assumed_power"]);
  });
});
