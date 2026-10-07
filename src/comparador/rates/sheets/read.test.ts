// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import type { generateStructured } from "@/comparador/ai/gateway";
import type { SheetGrid } from "./grid";
import { checkRecipe, readSpreadsheet } from "./read";
import type { SheetRecipe } from "./recipe";
import { memoryRecipeStore } from "./store";

function grid(name: string, rows: Record<number, Record<string, string | number>>): SheetGrid {
  const last = Math.max(...Object.keys(rows).map(Number));
  const out: SheetGrid["rows"] = [];
  for (let r = 1; r <= last; r++) {
    const cells = rows[r] ?? {};
    const width = Math.max(0, ...Object.keys(cells).map((col) => col.charCodeAt(0) - 64));
    out.push(
      Array.from({ length: width }, (_, c) => {
        const value = cells[String.fromCharCode(65 + c)];
        return value === undefined ? null : { value, text: String(value) };
      }),
    );
  }
  return { name, rows: out };
}

// Hoja de Eleia (SIMPLEX): energía y potencia en bloques separados.
const eleia = (energy = 0.258571) =>
  grid("SIMPLEX", {
    2: { A: "PRODUCTO SIMPLEX S3826" },
    13: { D: "€/kWh", E: "P1", F: "P2", G: "P3" },
    14: { D: "2.0TD", E: energy, F: 0.179856, G: 0.154568 },
    20: { D: "€/kW", E: "P1", F: "P2" },
    21: { D: "2.0TD", E: 27.704413, F: 0.725423 },
  });

const simplexRecipe: SheetRecipe = {
  supplierName: "Eleia",
  validFrom: null,
  validTo: null,
  skippedSheets: [],
  tables: [
    {
      sheet: "SIMPLEX",
      description: "energía",
      kind: "prices",
      firstRow: 14,
      lastRow: 14,
      startText: "€/kWh",
      rowFilter: { column: "D", pattern: "^2[.,]?0" },
      fillDown: [],
      repeat: [],
      sources: [
        { field: "productName", column: null, cell: null, value: "Simplex" },
        { field: "accessTariff", column: "D", cell: null, value: null },
        { field: "energyP1", column: "E", cell: null, value: null },
        { field: "energyP2", column: "F", cell: null, value: null },
        { field: "energyP3", column: "G", cell: null, value: null },
      ],
      expect: [{ cell: "D13", text: "€/kWh" }],
    },
    {
      sheet: "SIMPLEX",
      description: "potencia",
      kind: "power",
      firstRow: 21,
      lastRow: 21,
      startText: "€/kW",
      rowFilter: null,
      fillDown: [],
      repeat: [],
      sources: [
        { field: "productName", column: null, cell: null, value: "Simplex" },
        { field: "powerP1", column: "E", cell: null, value: null },
        { field: "powerP2", column: "F", cell: null, value: null },
        { field: "powerUnit", column: null, cell: null, value: "eur_kw_year" },
      ],
      expect: [{ cell: "D20", text: "€/kW" }],
    },
  ],
};

function fakeGenerate(outputs: SheetRecipe[]) {
  const generate = vi.fn(async () => ({
    output: outputs.shift(),
    model: "fake",
    usage: { inputTokens: 1000, outputTokens: 500 },
    costUsd: 0.004,
  }));
  return generate as unknown as typeof generateStructured & typeof generate;
}

const context = { tenantSlug: "test", jobType: "rate_extraction" as const };

describe("readSpreadsheet", () => {
  test("writes a recipe once and reuses it for free while the format holds", async () => {
    const store = memoryRecipeStore();
    const generate = fakeGenerate([simplexRecipe]);

    const first = await readSpreadsheet({
      grids: [eleia()], supplierName: "Eleia", context, store, models: ["a"], generate,
    });
    expect(first.recipe.source).toBe("generated");
    expect(first.result.status).toBe("ok");
    if (first.result.status === "out_of_scope") throw new Error("unexpected");
    expect(first.result.proposed[0]).toMatchObject({
      productName: "Simplex",
      energy: { P1: 0.258571, P2: 0.179856, P3: 0.154568 },
      sourceExcerpt: expect.stringContaining("fila 14"),
    });
    expect(first.result.proposed[0].power?.P1).toBeCloseTo(27.704413 / 365, 9);
    expect(store.entries.size).toBe(1);

    // El mes siguiente, mismos títulos y precios nuevos: sin llamar a la IA.
    const second = await readSpreadsheet({
      grids: [eleia(0.261)], supplierName: "Eleia", context, store, models: ["a"], generate,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(second.recipe.source).toBe("cache");
    expect(second.result.costUsd).toBeNull();
    if (second.result.status === "out_of_scope") throw new Error("unexpected");
    expect(second.result.proposed[0].energy?.P1).toBe(0.261);
  });

  test("a format change asks for a new recipe and says what broke", async () => {
    const store = memoryRecipeStore();
    await store.save({ supplierKey: "eleia", signature: "simplex", recipe: { ...simplexRecipe, tables: simplexRecipe.tables.map((t) => ({ ...t, anchorRow: 13 })) }, model: "a" });

    // La potencia ya no está en la fila 21 ni hay cabecera «€/kW».
    const changed = grid("SIMPLEX", {
      13: { D: "€/kWh", E: "P1", F: "P2", G: "P3" },
      14: { D: "2.0TD", E: 0.25, F: 0.17, G: 0.15 },
      30: { D: "Potencia €/kW año", E: "P1", F: "P2" },
      31: { D: "2.0TD", E: 27.704413, F: 0.725423 },
    });
    const fixed: SheetRecipe = {
      ...simplexRecipe,
      tables: [
        simplexRecipe.tables[0],
        { ...simplexRecipe.tables[1], firstRow: 31, lastRow: 31, startText: "Potencia", expect: [{ cell: "D30", text: "Potencia" }] },
      ],
    };
    const generate = fakeGenerate([fixed]);
    const result = await readSpreadsheet({
      grids: [changed], supplierName: "Eleia", context, store, models: ["a"], generate,
    });
    expect(result.recipe.source).toBe("generated");
    expect(result.result.status).toBe("ok");
    const call = (generate.mock.calls[0] as unknown as [{ messages: { content: { text: string }[] }[] }])[0];
    expect(call.messages[0].content.map(({ text }) => text).join("\n")).toContain("ya no encaja");
  });

  test("the second model fixes a recipe that reads nothing", async () => {
    const wrong: SheetRecipe = {
      ...simplexRecipe,
      tables: [{ ...simplexRecipe.tables[0], firstRow: 40, lastRow: 40, startText: null, expect: [] }],
    };
    const generate = fakeGenerate([wrong, simplexRecipe]);
    const result = await readSpreadsheet({
      grids: [eleia()], supplierName: "Eleia", context, store: memoryRecipeStore(), models: ["a", "b"], generate,
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.result.status).toBe("ok");
    if (result.result.status === "out_of_scope") throw new Error("unexpected");
    expect(result.result.attempts.map(({ model }) => model)).toEqual(["a", "b"]);
  });

  // Libro de dos hojas: SIMPLEX (energía y potencia) y FIJO (una tabla).
  const fijo = (row = 5) =>
    grid("FIJO", {
      [row - 1]: { B: "Tarifa", C: "P1", D: "P2", E: "P3", F: "Pot P1", G: "Pot P2" },
      [row]: { B: "2.0TD", C: 0.15, D: 0.14, E: 0.13, F: 30.1, G: 3.2 },
    });
  const fijoTable = (row = 5): SheetRecipe["tables"][number] => ({
    sheet: "FIJO",
    description: "fijo",
    kind: "prices",
    firstRow: row,
    lastRow: row,
    startText: null,
    rowFilter: null,
    fillDown: [],
    repeat: [],
    sources: [
      { field: "productName", column: null, cell: null, value: "Fijo" },
      { field: "energyP1", column: "C", cell: null, value: null },
      { field: "energyP2", column: "D", cell: null, value: null },
      { field: "energyP3", column: "E", cell: null, value: null },
      { field: "powerP1", column: "F", cell: null, value: null },
      { field: "powerP2", column: "G", cell: null, value: null },
      { field: "powerUnit", column: null, cell: null, value: "eur_kw_year" },
    ],
    expect: [{ cell: `B${row - 1}`, text: "Tarifa" }],
  });
  const prompt = (generate: ReturnType<typeof fakeGenerate>) =>
    (generate.mock.calls[0] as unknown as [{ messages: { content: { text: string }[] }[] }])[0].messages[0].content
      .map(({ text }) => text)
      .join("\n");

  test("only the sheet that broke is rewritten; the rest of the recipe is kept", async () => {
    const store = memoryRecipeStore();
    const both: SheetRecipe = { ...simplexRecipe, tables: [...simplexRecipe.tables, fijoTable()] };
    await readSpreadsheet({
      grids: [eleia(), fijo()], supplierName: "Eleia", context, store, models: ["a"], generate: fakeGenerate([both]),
    });

    // FIJO baja tres filas sin texto ancla: solo esa hoja vuelve a la IA.
    const generate = fakeGenerate([{ ...simplexRecipe, tables: [fijoTable(8)] }]);
    const result = await readSpreadsheet({
      grids: [eleia(), fijo(8)], supplierName: "Eleia", context, store, models: ["a"], generate,
    });
    expect(result.recipe.source).toBe("repaired");
    expect(result.result.status).toBe("ok");
    expect(prompt(generate)).toContain("solo hay que rehacer «FIJO»");
    expect(prompt(generate)).not.toContain("PRODUCTO SIMPLEX");
    if (result.result.status === "out_of_scope") throw new Error("unexpected");
    expect(result.result.proposed.map(({ productName }) => productName).sort()).toEqual(["Fijo", "Simplex"]);
    expect([...store.entries.values()][0].recipe.tables.map(({ sheet }) => sheet).sort()).toEqual([
      "FIJO",
      "SIMPLEX",
      "SIMPLEX",
    ]);
  });

  test("a new sheet is added to the supplier's last recipe instead of starting over", async () => {
    const store = memoryRecipeStore();
    await readSpreadsheet({
      grids: [eleia()], supplierName: "Eleia", context, store, models: ["a"], generate: fakeGenerate([simplexRecipe]),
    });

    const generate = fakeGenerate([{ ...simplexRecipe, tables: [fijoTable()] }]);
    const result = await readSpreadsheet({
      grids: [eleia(), fijo()], supplierName: "Eleia", context, store, models: ["a"], generate,
    });
    expect(result.recipe.source).toBe("repaired");
    expect(result.result.status).toBe("ok");
    expect(prompt(generate)).toContain("Hojas nuevas, sin tablas todavía: FIJO");
    expect(store.entries.size).toBe(2);
  });

  test("2.0TD rows the recipe does not read are caught, and the next model is told which", async () => {
    // Un bloque nuevo (fila 17) que la plantilla no lee.
    const sheet = grid("SIMPLEX", {
      2: { A: "PRODUCTO SIMPLEX S3826" },
      13: { D: "€/kWh", E: "P1", F: "P2", G: "P3" },
      14: { D: "2.0TD", E: 0.258571, F: 0.179856, G: 0.154568 },
      17: { C: "N2", D: "2.0TD", E: 0.248571, F: 0.169856, G: 0.144568 },
      20: { D: "€/kW", E: "P1", F: "P2" },
      21: { D: "2.0TD", E: 27.704413, F: 0.725423 },
    });
    const complete: SheetRecipe = {
      ...simplexRecipe,
      tables: [
        ...simplexRecipe.tables,
        {
          ...simplexRecipe.tables[0],
          firstRow: 17,
          lastRow: 17,
          startText: null,
          expect: [],
          sources: [...simplexRecipe.tables[0].sources, { field: "level", column: "C", cell: null, value: null }],
        },
      ],
    };
    const generate = fakeGenerate([simplexRecipe, complete]);
    const result = await readSpreadsheet({
      grids: [sheet], supplierName: "Eleia", context, store: memoryRecipeStore(), models: ["a", "b"], generate,
    });
    const second = (generate.mock.calls[1] as unknown as [{ messages: { content: { text: string }[] }[] }])[0];
    expect(second.messages[0].content.map(({ text }) => text).join("\n")).toContain(
      "la fila 17 tiene precios de 2.0TD que la plantilla no lee",
    );
    expect(result.result.status).toBe("ok");
  });

  test("a sheet numbered with the edition is the same sheet next month, for free", async () => {
    const edition = (name: string, energy: number) => ({ ...eleia(energy), name });
    const store = memoryRecipeStore();
    const july: SheetRecipe = {
      ...simplexRecipe,
      tables: simplexRecipe.tables.map((table) => ({ ...table, sheet: "Precios y13.2026" })),
    };
    await readSpreadsheet({
      grids: [edition("Precios y13.2026", 0.258571)], supplierName: "YaLuz", context, store, models: ["a"],
      generate: fakeGenerate([july]),
    });

    const generate = fakeGenerate([]);
    const august = await readSpreadsheet({
      grids: [edition("Precios y14.2026", 0.261)], supplierName: "YaLuz", context, store, models: ["a"], generate,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(august.recipe.source).toBe("cache");
    if (august.result.status === "out_of_scope") throw new Error("unexpected");
    expect(august.result.proposed[0].energy?.P1).toBe(0.261);
  });

  test("coverage ignores power columns and the blocks a recipe skips on purpose", () => {
    // Logos: a la derecha de los fijos, un indexado con potencia €/kW día
    // (0,1088 / 0,0349, que parece energía) y un coeficiente A en €/kWh.
    const sheet = grid("SIMPLEX", {
      2: { A: "PRODUCTO SIMPLEX S3826" },
      12: { I: "Potencia €/kW día", L: "A (€/kWh)" },
      13: { D: "€/kWh", E: "P1", F: "P2", G: "P3" },
      14: { D: "2.0TD", E: 0.258571, F: 0.179856, G: 0.154568, H: "2.0TD", I: 0.108779, J: 0.034864, L: 0.162774, M: 0.093834 },
      20: { D: "€/kW", E: "P1", F: "P2" },
      21: { D: "2.0TD", E: 27.704413, F: 0.725423 },
    });
    const recipe = { ...simplexRecipe, tables: simplexRecipe.tables.map((table) => ({ ...table, anchorRow: null })) };
    const unread = checkRecipe([sheet], recipe);
    expect(unread.healthy).toBe(false);
    expect(unread.report.join("\n")).toContain("la fila 14 tiene precios de 2.0TD que la plantilla no lee");

    const skipped = checkRecipe([sheet], {
      ...recipe,
      skippedRanges: [{ sheet: "SIMPLEX", range: "H10:M30", reason: "indexado" }],
    });
    expect(skipped.healthy).toBe(true);
    expect(skipped.applied.extraction.skipped).toContain("SIMPLEX H10:M30 (indexado)");
  });
});
