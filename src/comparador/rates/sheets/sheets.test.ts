import { describe, expect, test } from "vitest";
import { applyRecipe, type StoredRecipe } from "./apply";
import type { SheetGrid } from "./grid";
import {
  parseBand,
  parseDates,
  parseMonth,
  parseNumber,
  parseTariff,
  parseTerm,
} from "./parse";
import type { RecipeTable } from "./recipe";

/** Cuadrícula a partir de filas { "B": valor } con números de fila de Excel. */
function grid(name: string, rows: Record<number, Record<string, string | number>>): SheetGrid {
  const last = Math.max(...Object.keys(rows).map(Number));
  const out: SheetGrid["rows"] = [];
  for (let r = 1; r <= last; r++) {
    const cells = rows[r] ?? {};
    const width = Math.max(0, ...Object.keys(cells).map((col) => col.charCodeAt(0) - 64));
    const row: SheetGrid["rows"][number] = [];
    for (let c = 0; c < width; c++) {
      const value = cells[String.fromCharCode(65 + c)];
      row.push(value === undefined ? null : { value, text: String(value) });
    }
    out.push(row);
  }
  return { name, rows: out };
}

const cell = (value: string | number) => ({ value, text: String(value) });

function table(overrides: Partial<RecipeTable>): RecipeTable {
  return {
    sheet: "Hoja",
    description: "tabla",
    kind: "prices",
    firstRow: 1,
    lastRow: 1,
    startText: null,
    rowFilter: null,
    fillDown: [],
    repeat: [],
    sources: [],
    expect: [],
    ...overrides,
  };
}

const recipe = (tables: StoredRecipe["tables"], extra: Partial<StoredRecipe> = {}): StoredRecipe => ({
  supplierName: null,
  validFrom: null,
  validTo: null,
  tables,
  skippedSheets: [],
  ...extra,
});

describe("cell value parsers", () => {
  test("numbers as suppliers write them", () => {
    expect(parseNumber(cell("0.173154 €"))).toEqual({ ok: true, value: 0.173154 });
    expect(parseNumber(cell("0,109000\t"))).toEqual({ ok: true, value: 0.109 });
    expect(parseNumber(cell("1.000,50"))).toEqual({ ok: true, value: 1000.5 });
    expect(parseNumber(cell("- €"))).toEqual({ ok: true, value: null });
    expect(parseNumber(cell("-"))).toEqual({ ok: true, value: null });
    expect(parseNumber(cell("#REF!")).ok).toBe(false);
    expect(parseNumber(cell("Tarifa")).ok).toBe(false);
  });

  test("access tariffs, including the single-price notation", () => {
    expect(parseTariff("2.0TD")).toEqual({ tariff: "2.0TD", singlePrice: false });
    expect(parseTariff("20TD")).toEqual({ tariff: "2.0TD", singlePrice: false });
    expect(parseTariff("2.0TD_2 Plan Estable")).toEqual({ tariff: "2.0TD", singlePrice: false });
    expect(parseTariff("2.01P")).toEqual({ tariff: "2.0TD", singlePrice: true });
    expect(parseTariff("3.0TD")?.tariff).toBe("3.0TD");
    expect(parseTariff("Tarifa")).toBeNull();
  });

  test("power and consumption bands", () => {
    expect(parseBand("2.0TD _ 2     P1 <= 10kW", "kw")).toEqual({ min: null, max: 10 });
    expect(parseBand("2.0TD _ 3     P1 > 10kW", "kw")).toEqual({ min: 10, max: null });
    expect(parseBand("> 10kW y ≤ 15kW", "kw")).toEqual({ min: 10, max: 15 });
    expect(parseBand("10-15KW", "kw")).toEqual({ min: 10, max: 15 });
    expect(parseBand("2.0TD 1.000 - 5.000", "kwh")).toEqual({ min: 1000, max: 5000 });
    expect(parseBand("2.0TD  >  50.000", "kwh")).toEqual({ min: 50000, max: null });
    expect(parseBand("Consumos 0-50.000 kWh/año", "kwh")).toEqual({ min: 0, max: 50000 });
    expect(parseBand("<= 5 MWh/año", "kwh")).toEqual({ min: null, max: 5000 });
  });

  test("months, dates and terms", () => {
    expect(parseMonth(cell("Inicio Enero27"))).toEqual({ from: "2027-01-01", to: "2027-01-31" });
    expect(parseMonth(cell("Inicio Diciembre26"))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(parseDates(cell("Ofertas válidas desde el 01-10-2026 hasta el 15-10-2026"))).toEqual([
      "2026-10-01",
      "2026-10-15",
    ]);
    expect(parseDates(cell("Última actualización: 01 de octubre de 2026"))).toEqual(["2026-10-01"]);
    expect(parseDates({ value: 46296, text: "10/1/26" })).toEqual(["2026-10-01"]);
    expect(parseTerm(" 60m / 12m ")).toBe(60);
    expect(parseTerm("2 años")).toBe(24);
  });
});

describe("applyRecipe", () => {
  // Hoja de Axpo: tres niveles en paralelo, mes de inicio en la columna A del
  // bloque y la potencia en un bloque aparte.
  const axpo = grid("1P Plus (Península)", {
    7: { B: "SUPER (N1)", K: "ESTANDAR (N2)" },
    10: { B: "Tarifa", C: "P1", D: "P2", E: "P3", K: "Tarifa", L: "P1", M: "P2", N: "P3" },
    11: { A: "Inicio Enero27", B: "2.0TD", C: 0.169233, D: 0.169233, E: 0.169233, J: "Inicio Enero27", K: "2.0TD", L: 0.164157, M: 0.164157, N: 0.164157 },
    12: { B: "3.0TD", C: 0.149508, D: 0.149508, E: 0.149508, K: "3.0TD", L: 0.144432, M: 0.144432, N: 0.144432 },
    13: { A: "Inicio Diciembre26", B: "2.0TD", C: 0.174924, D: 0.174924, E: 0.174924, J: "Inicio Diciembre26", K: "2.0TD", L: 0.169848, M: 0.169848, N: 0.169848 },
    21: { M: "POTENCIAS" },
    25: { B: "Tarifa", C: "P1", D: "P2", K: "Tarifa", L: "P1", M: "P2" },
    26: { B: "2.0TD", C: 39.704413, D: 21.725423, K: "2.0TD", L: 37.704413, M: 19.725423 },
  });

  const axpoRecipe = recipe([
    table({
      sheet: "1P Plus (Península)",
      description: "energía por nivel y mes de inicio",
      firstRow: 11,
      lastRow: 13,
      rowFilter: { column: "B", pattern: "^2\\.?0" },
      repeat: [{ columnShift: 9, rowShift: 0, values: [{ field: "level", value: "N2" }] }],
      sources: [
        { field: "productName", column: null, cell: null, value: "1P Plus" },
        { field: "level", column: null, cell: null, value: "N1" },
        { field: "accessTariff", column: "B", cell: null, value: null },
        { field: "startMonth", column: "A", cell: null, value: null },
        { field: "energyP1", column: "C", cell: null, value: null },
        { field: "energyP2", column: "D", cell: null, value: null },
        { field: "energyP3", column: "E", cell: null, value: null },
        { field: "energyUnit", column: null, cell: null, value: "eur_kwh" },
      ],
      expect: [{ cell: "B7", text: "SUPER (N1)" }, { cell: "B10", text: "Tarifa" }],
    }),
    table({
      sheet: "1P Plus (Península)",
      description: "potencia por nivel",
      kind: "power",
      firstRow: 26,
      lastRow: 26,
      rowFilter: { column: "B", pattern: "^2\\.?0" },
      repeat: [{ columnShift: 9, rowShift: 0, values: [{ field: "level", value: "N2" }] }],
      sources: [
        { field: "productName", column: null, cell: null, value: "1P Plus" },
        { field: "level", column: null, cell: null, value: "N1" },
        { field: "powerP1", column: "C", cell: null, value: null },
        { field: "powerP2", column: "D", cell: null, value: null },
        { field: "powerUnit", column: null, cell: null, value: "eur_kw_year" },
      ],
    }),
  ]);

  test("reads parallel level blocks, start months and joins the power block", () => {
    const { extraction, problems, excerpts } = applyRecipe([axpo], axpoRecipe);
    expect(problems).toEqual([]);
    expect(extraction.rates).toHaveLength(4);
    expect(
      extraction.rates.map(({ level, startFrom, energyP1, powerP1 }) => [level, startFrom, energyP1, powerP1]),
    ).toEqual([
      ["N1", "2027-01-01", 0.169233, 39.704413],
      ["N1", "2026-12-01", 0.174924, 39.704413],
      ["N2", "2027-01-01", 0.164157, 37.704413],
      ["N2", "2026-12-01", 0.169848, 37.704413],
    ]);
    expect(extraction.rates[0]).toMatchObject({ powerMode: "fixed", powerUnit: "eur_kw_year", singlePrice: false });
    expect(excerpts[0]).toContain("fila 11");
  });

  test("power figures win over a declared BOE, and a block can serve two territories", () => {
    const islands = grid("Islas", {
      9: { B: "Baleares" },
      11: { B: "2.0TD", C: 0.179794 },
      22: { B: "Canarias" },
      24: { B: "2.0TD", C: 0.180987 },
      37: { B: "Baleares y Canarias" },
      40: { B: "2.0TD", C: 39.704413, D: 21.725423 },
    });
    const prices = (row: number, territory: string) =>
      table({
        sheet: "Islas",
        firstRow: row,
        lastRow: row,
        sources: [
          { field: "productName", column: null, cell: null, value: "1P Plus" },
          { field: "level", column: null, cell: null, value: "N1" },
          { field: "territory", column: null, cell: null, value: territory },
          { field: "energyP1", column: "C", cell: null, value: null },
          { field: "powerMode", column: null, cell: null, value: "regulated" },
        ],
      });
    const { extraction, problems } = applyRecipe(
      [islands],
      recipe([
        prices(11, "Baleares"),
        prices(24, "Canarias"),
        table({
          sheet: "Islas",
          kind: "power",
          firstRow: 40,
          lastRow: 40,
          sources: [
            { field: "productName", column: null, cell: null, value: "1P Plus" },
            { field: "level", column: null, cell: null, value: "SUPER (N1)" },
            { field: "territory", column: null, cell: "B37", value: null },
            { field: "powerP1", column: "C", cell: null, value: null },
            { field: "powerP2", column: "D", cell: null, value: null },
          ],
        }),
      ]),
    );
    expect(problems).toEqual([]);
    expect(extraction.rates.map(({ territory, powerMode, powerP1 }) => [territory, powerMode, powerP1])).toEqual([
      ["baleares", "fixed", 39.704413],
      ["canarias", "fixed", 39.704413],
    ]);
  });

  test("power of another level is never joined: it is reported", () => {
    const sheet = grid("Hoja", {
      11: { B: "2.0TD", C: 0.169233 },
      26: { B: "2.0TD", C: 37.704413, D: 19.725423 },
    });
    const { extraction, problems } = applyRecipe(
      [sheet],
      recipe([
        table({
          sheet: "Hoja",
          firstRow: 11,
          lastRow: 11,
          sources: [
            { field: "level", column: null, cell: null, value: "N1" },
            { field: "energyP1", column: "C", cell: null, value: null },
          ],
        }),
        table({
          sheet: "Hoja",
          kind: "power",
          firstRow: 26,
          lastRow: 26,
          sources: [
            { field: "level", column: null, cell: null, value: "N2" },
            { field: "powerP1", column: "C", cell: null, value: null },
            { field: "powerP2", column: "D", cell: null, value: null },
          ],
        }),
      ]),
    );
    expect(extraction.rates[0].powerMode).toBe("not_stated");
    expect(problems.some((problem) => problem.message.includes("ninguna fila de potencia casa"))).toBe(true);
  });

  test("a declared BOE does not hide a power block that does not match", () => {
    const sheet = grid("Islas", {
      11: { B: "2.0TD", C: 0.179794 },
      40: { B: "2.0TD", C: 39.704413, D: 21.725423 },
    });
    const { extraction, problems } = applyRecipe(
      [sheet],
      recipe([
        table({
          sheet: "Islas",
          firstRow: 11,
          lastRow: 11,
          sources: [
            { field: "level", column: null, cell: null, value: "N1" },
            { field: "energyP1", column: "C", cell: null, value: null },
            { field: "powerMode", column: null, cell: null, value: "regulated" },
          ],
        }),
        table({
          sheet: "Islas",
          kind: "power",
          firstRow: 40,
          lastRow: 40,
          sources: [
            { field: "level", column: null, cell: null, value: "Baleares y Canarias" },
            { field: "powerP1", column: "C", cell: null, value: null },
            { field: "powerP2", column: "D", cell: null, value: null },
          ],
        }),
      ]),
    );
    expect(extraction.rates[0].powerMode).toBe("regulated");
    expect(problems.some((problem) => problem.message.includes("ninguna fila de potencia casa"))).toBe(true);
  });

  test("a $ row stays put while the copies move down to another territory", () => {
    // Axpo (islas): Baleares en la fila 11, Canarias 13 filas más abajo, y una
    // sola fila de potencia (40) para los dos, con un nivel por columna.
    const sheet = grid("Islas", {
      11: { B: "2.0TD", C: 0.179794, K: "2.0TD", L: 0.174718 },
      24: { B: "2.0TD", C: 0.180987, K: "2.0TD", L: 0.17591 },
      40: { B: "2.0TD", C: 39.704413, D: 21.725423, K: "2.0TD", L: 37.704413, M: 19.725423 },
    });
    const { extraction, problems } = applyRecipe(
      [sheet],
      recipe([
        table({
          sheet: "Islas",
          firstRow: 11,
          lastRow: 11,
          repeat: [
            { columnShift: 9, rowShift: 0, values: [{ field: "level", value: "N2" }] },
            { columnShift: 0, rowShift: 13, values: [{ field: "territory", value: "canarias" }] },
            {
              columnShift: 9,
              rowShift: 13,
              values: [
                { field: "level", value: "N2" },
                { field: "territory", value: "canarias" },
              ],
            },
          ],
          sources: [
            { field: "level", column: null, cell: null, value: "N1" },
            { field: "territory", column: null, cell: null, value: "baleares" },
            { field: "energyP1", column: "C", cell: null, value: null },
            { field: "powerP1", column: null, cell: "C$40", value: null },
            { field: "powerP2", column: null, cell: "D$40", value: null },
            { field: "powerUnit", column: null, cell: null, value: "eur_kw_year" },
          ],
        }),
      ]),
    );
    expect(problems).toEqual([]);
    expect(
      extraction.rates.map(({ level, territory, energyP1, powerP1, powerP2 }) => [
        level,
        territory,
        energyP1,
        powerP1,
        powerP2,
      ]),
    ).toEqual([
      ["N1", "baleares", 0.179794, 39.704413, 21.725423],
      ["N2", "baleares", 0.174718, 37.704413, 19.725423],
      ["N1", "canarias", 0.180987, 39.704413, 21.725423],
      ["N2", "canarias", 0.17591, 37.704413, 19.725423],
    ]);
  });

  test("a band only the power block has is inherited, unless two blocks tie", () => {
    const prices = table({
      sheet: "Hoja",
      firstRow: 2,
      lastRow: 2,
      sources: [
        { field: "productName", column: null, cell: null, value: "1P Plus" },
        { field: "energyP1", column: "C", cell: null, value: null },
      ],
    });
    const power = (row: number, band: string) =>
      table({
        sheet: "Hoja",
        kind: "power",
        firstRow: row,
        lastRow: row,
        sources: [
          { field: "productName", column: null, cell: null, value: "1P Plus" },
          { field: "consumptionBand", column: null, cell: null, value: band },
          { field: "powerP1", column: "C", cell: null, value: null },
          { field: "powerP2", column: "D", cell: null, value: null },
        ],
      });
    const sheet = grid("Hoja", {
      2: { B: "2.0TD", C: 0.17 },
      5: { B: "2.0TD", C: 39.7, D: 21.7 },
      8: { B: "2.0TD", C: 41.2, D: 23.1 },
    });

    const one = applyRecipe([sheet], recipe([prices, power(5, "Consumos 0-50.000 kWh/año")]));
    expect(one.problems).toEqual([]);
    expect(one.extraction.rates[0]).toMatchObject({ powerP1: 39.7, minKwh: 0, maxKwh: 50000 });

    // Dos potencias con bandas distintas y la fila de precios sin banda: no
    // se elige una al azar.
    const two = applyRecipe(
      [sheet],
      recipe([prices, power(5, "Consumos 0-50.000 kWh/año"), power(8, "Consumos 50.000-100.000 kWh/año")]),
    );
    expect(two.problems.some(({ message }) => message.includes("igual de bien"))).toBe(true);
  });

  test("finds the rows again when the supplier adds lines above", () => {
    // Dos filas nuevas al principio: todo baja dos filas.
    const moved: SheetGrid = { ...axpo, rows: [[], [], ...axpo.rows] };
    const withAnchor = recipe(
      axpoRecipe.tables.map((t, index) =>
        index === 0 ? { ...t, startText: "SUPER (N1)", anchorRow: 7 } : { ...t, startText: "POTENCIAS", anchorRow: 21 },
      ),
    );
    const { extraction, problems } = applyRecipe([moved], withAnchor);
    expect(problems).toEqual([]);
    expect(extraction.rates).toHaveLength(4);
  });

  test("a different layout is reported instead of read wrong", () => {
    const changed = grid("1P Plus (Península)", { 7: { B: "OTRA COSA" }, 11: { B: "2.0TD", C: "#REF!" } });
    const { problems } = applyRecipe([changed], axpoRecipe);
    expect(problems.some((problem) => problem.message.includes("se esperaba «SUPER (N1)»"))).toBe(true);
  });

  test("the same block repeated further down for another product", () => {
    // Axpo repite el bloque de energía más abajo para 1P Plus XL.
    const twoProducts = grid("1P Plus (Península)", {
      10: { B: "Tarifa", C: "P1" },
      11: { A: "Inicio Enero27", B: "2.0TD", C: 0.169233 },
      37: { B: "Tarifa", C: "P1" },
      38: { A: "Inicio Enero27", B: "2.0TD", C: 0.159081 },
    });
    const { extraction, problems } = applyRecipe(
      [twoProducts],
      recipe([
        table({
          sheet: "1P Plus (Península)",
          firstRow: 11,
          lastRow: 11,
          repeat: [{ columnShift: 0, rowShift: 27, values: [{ field: "productName", value: "1P Plus XL" }] }],
          sources: [
            { field: "productName", column: null, cell: null, value: "1P Plus" },
            { field: "startMonth", column: "A", cell: null, value: null },
            { field: "energyP1", column: "C", cell: null, value: null },
            { field: "powerMode", column: null, cell: null, value: "regulated" },
          ],
        }),
      ]),
    );
    expect(problems).toEqual([]);
    expect(extraction.rates.map(({ productName, energyP1 }) => [productName, energyP1])).toEqual([
      ["1P Plus", 0.169233],
      ["1P Plus XL", 0.159081],
    ]);
    expect(extraction.rates[0]).toMatchObject({ powerMode: "regulated", singlePrice: true });
  });

  test("fill-down groups, bands from section rows and single-price products", () => {
    // Nordy: subsistema y tarifa solo en la primera fila del grupo.
    const nordy = grid("Precios", {
      2: { B: "Ofertas válidas desde el 01-10-2026 hasta el 15-10-2026" },
      4: { B: "Subsistema", C: "Tarifa", D: "Producto", E: "P1", F: "P2", K: "P1", L: "P2", M: "P3" },
      5: { B: "PENÍNSULA", C: "2.0TD", D: "+Oslo I", E: 0.0974, F: 0.043, K: 0.1499, L: 0.1499, M: 0.1499 },
      6: { D: "+Oslo II", E: 0.0844, F: 0.0844, K: 0.1499, L: 0.1499, M: 0.1499 },
      7: { C: "3.0TD", D: "+Oslo I", E: 0.0743, F: 0.046, K: 0.1399, L: 0.1399, M: 0.1399 },
      8: { B: "BALEARES", C: "2.0TD", D: "Oslo I", E: 0.0974, F: 0.043, K: 0.1699, L: 0.1699, M: 0.1699 },
    });
    const { extraction, problems } = applyRecipe(
      [nordy],
      recipe(
        [
          table({
            sheet: "Precios",
            firstRow: 5,
            lastRow: 8,
            fillDown: ["B", "C"],
            rowFilter: { column: "C", pattern: "^2\\.0" },
            sources: [
              { field: "territory", column: "B", cell: null, value: null },
              { field: "accessTariff", column: "C", cell: null, value: null },
              { field: "productName", column: "D", cell: null, value: null },
              { field: "powerP1", column: "E", cell: null, value: null },
              { field: "powerP2", column: "F", cell: null, value: null },
              { field: "energyP1", column: "K", cell: null, value: null },
              { field: "energyP2", column: "L", cell: null, value: null },
              { field: "energyP3", column: "M", cell: null, value: null },
              { field: "powerUnit", column: null, cell: null, value: "eur_kw_day" },
            ],
          }),
        ],
        { validFrom: { sheet: "Precios", cell: "B2" }, validTo: { sheet: "Precios", cell: "B2" } },
      ),
    );
    expect(problems).toEqual([]);
    expect(extraction.validFrom).toBe("2026-10-01");
    expect(extraction.validTo).toBe("2026-10-15");
    expect(extraction.rates.map(({ productName, territory }) => [productName, territory])).toEqual([
      ["+Oslo I", "peninsula"],
      ["+Oslo II", "peninsula"],
      ["Oslo I", "baleares"],
    ]);
  });

  test("bands from a section title and a product appended at the end", () => {
    // Iberdrola: la banda de potencia va en la fila de título de la sección.
    const iberdrola = grid("Energía", {
      19: { B: "2.0TD _ 2     P1 <= 10kW" },
      20: { B: "2.0TD_2 Plan Estable", C: 39.99, D: 31.49, I: 0.187375, O: "15% s/Te (+5% PyS Tier 1)", Q: " 60m / 12m " },
      21: { B: "2.0TD_2 Plan Nuevo", C: 39.99, D: 31.49, I: 0.199, Q: " 12m " },
    });
    const { extraction, problems } = applyRecipe(
      [iberdrola],
      recipe([
        table({
          sheet: "Energía",
          firstRow: 20,
          lastRow: 20,
          sources: [
            { field: "productName", column: "B", cell: null, value: null },
            { field: "powerBand", column: null, cell: "B19", value: null },
            { field: "powerP1", column: "C", cell: null, value: null },
            { field: "powerP2", column: "D", cell: null, value: null },
            { field: "energyP1", column: "I", cell: null, value: null },
            { field: "discountText", column: "O", cell: null, value: null },
            { field: "termMonths", column: "Q", cell: null, value: null },
            { field: "powerUnit", column: null, cell: null, value: "eur_kw_year" },
          ],
        }),
      ]),
    );
    expect(problems).toEqual([]);
    expect(extraction.rates).toHaveLength(2);
    expect(extraction.rates[0]).toMatchObject({
      maxKw: 10,
      months: 60,
      singlePrice: true,
      discounts: [expect.objectContaining({ conditional: true })],
    });
  });

  // Una tabla de una hoja «Precios», con la tarifa en B y la energía en C-E.
  const priceTable = (overrides: Partial<RecipeTable> = {}) =>
    table({
      sheet: "Precios",
      firstRow: 3,
      lastRow: 3,
      sources: [
        { field: "productName", column: "A", cell: null, value: null },
        { field: "accessTariff", column: "B", cell: null, value: null },
        { field: "energyP1", column: "C", cell: null, value: null },
        { field: "energyP2", column: "D", cell: null, value: null },
        { field: "energyP3", column: "E", cell: null, value: null },
        { field: "powerMode", column: null, cell: null, value: "regulated" },
      ],
      ...overrides,
    });

  test("products a fixed-price comparator cannot price are kept out of scope", () => {
    const sheet = grid("Precios", {
      3: { A: "Plan Estable", B: "2.0TD", C: 0.18, D: 0.15, E: 0.12 },
      4: { A: "Plan 8 horas", B: "2.0TD", C: 0.28, D: 0.14 },
      5: { A: "Plan OMIE 1", B: "2.0TD", C: 0.015, D: 0.015, E: 0.015 },
    });
    const { extraction, problems } = applyRecipe([sheet], recipe([priceTable({ lastRow: 5 })]));
    expect(problems).toEqual([]);
    expect(extraction.rates.map(({ productName, pricing }) => [productName, pricing])).toEqual([
      ["Plan Estable", "fixed"],
      ["Plan 8 horas", "other"],
      ["Plan OMIE 1", "indexed"],
    ]);
  });

  test("an impossible declared unit gives way to the magnitude", () => {
    const sheet = grid("Precios", { 3: { A: "Fijo", B: "2.0TD", C: 24.84, D: 21.68, E: 19.97 } });
    const withUnit = priceTable();
    withUnit.sources.push({ field: "energyUnit", column: null, cell: null, value: "eur_kwh" });
    const { extraction } = applyRecipe([sheet], recipe([withUnit]));
    expect(extraction.rates[0].energyUnit).toBe("cent_kwh");
  });

  test("the same product by periods and at a single price are two rates", () => {
    const sheet = grid("Precios", {
      3: { A: "Ahorro", B: "2.0TD", C: 0.24, D: 0.16, E: 0.13, G: "2.0TD", H: 0.17, I: 0.17, J: 0.17 },
    });
    const { extraction } = applyRecipe(
      [sheet],
      recipe([
        priceTable({
          repeat: [{ columnShift: 5, rowShift: 0, values: [{ field: "singlePrice", value: "true" }] }],
          sources: [
            { field: "productName", column: null, cell: "A3", value: null },
            { field: "accessTariff", column: "B", cell: null, value: null },
            { field: "energyP1", column: "C", cell: null, value: null },
            { field: "energyP2", column: "D", cell: null, value: null },
            { field: "energyP3", column: "E", cell: null, value: null },
            { field: "singlePrice", column: null, cell: null, value: "false" },
            { field: "powerMode", column: null, cell: null, value: "regulated" },
          ],
        }),
      ]),
    );
    // La celda A3 desplazada (F3) está vacía: el nombre sale de la original.
    expect(extraction.rates.map(({ productName }) => productName)).toEqual(["Ahorro", "Ahorro (precio único)"]);
  });

  test("territory from the block header, abbreviations, and contradictions", () => {
    const sheet = grid("Precios", {
      1: { C: "Precios Energía (€/kWh) - Canarias" },
      3: { A: "Fijo", B: "2.0TD", C: 0.2, D: 0.15, E: 0.12 },
    });
    // Sin territorio en la plantilla: el de la cabecera.
    expect(applyRecipe([sheet], recipe([priceTable()])).extraction.rates[0].territory).toBe("canarias");

    // La plantilla dice otro: no encaja.
    const wrong = priceTable();
    wrong.sources.push({ field: "territory", column: null, cell: null, value: "peninsula" });
    const contradicted = applyRecipe([sheet], recipe([wrong]));
    expect(contradicted.problems.some(({ message }) => message.includes("la cabecera del bloque dice canarias"))).toBe(true);

    // «BAL» en la columna de subsistema; algo ilegible no se da por península.
    const bySubsystem = grid("Precios", {
      3: { A: "Fijo", B: "2.0TD", C: 0.2, D: 0.15, E: 0.12, F: "BAL" },
      4: { A: "Fijo", B: "2.0TD", C: 0.21, D: 0.16, E: 0.13, F: "Zona X" },
    });
    const territory = priceTable({ lastRow: 4 });
    territory.sources.push({ field: "territory", column: "F", cell: null, value: null });
    const read = applyRecipe([bySubsystem], recipe([territory]));
    expect(read.extraction.rates.map(({ territory }) => territory)).toEqual(["baleares"]);
    expect(read.problems.some(({ message }) => message.includes("no se reconoce el territorio «Zona X»"))).toBe(true);
  });

  test("header rows inside a block are skipped and numeric expectations ignored", () => {
    const sheet = grid("Precios", {
      2: { B: "Tarifa" },
      3: { A: "Fijo", B: "2.0TD", C: 0.2, D: 0.15, E: 0.12 },
      4: { B: "Tarifa", C: "P1", D: "P2", E: "P3" },
      5: { A: "Fijo 2", B: "2.0TD", C: 0.21, D: 0.16, E: 0.13 },
    });
    const { extraction, problems } = applyRecipe(
      [sheet],
      recipe([priceTable({ lastRow: 5, expect: [{ cell: "C3", text: "0.199" }, { cell: "B2", text: "B=Tarifa" }] })]),
    );
    expect(problems).toEqual([]);
    expect(extraction.rates.map(({ productName }) => productName)).toEqual(["Fijo", "Fijo 2"]);
  });
});
