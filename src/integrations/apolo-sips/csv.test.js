import { describe, expect, test } from "bun:test";
import { GAS_CONSUMPTION_COLUMNS } from "./columns.ts";
import { parseCsv } from "./csv.ts";
import { normalizeApoloSipsCsv } from "./normalize.ts";

describe("SIPS CSV parser", () => {
  test("parses header-only CSV as no data rows", () => {
    const parsed = parseCsv("cups,fechaInicioMesConsumo\n");

    expect(parsed.columns).toEqual(["cups", "fechaInicioMesConsumo"]);
    expect(parsed.rows).toEqual([]);
  });

  test("parses quoted values containing commas", () => {
    const parsed = parseCsv('cups,nombre\n"ES0222120028021251AW","Empresa, S.L."\n');

    expect(parsed.rows).toEqual([["ES0222120028021251AW", "Empresa, S.L."]]);
  });

  test("normalizes empty cells to null and numeric cells to numbers", () => {
    const row = GAS_CONSUMPTION_COLUMNS.map((column) => {
      if (column === "cups") return "ES0222120028021251AW";
      if (column === "fechaInicioMesConsumo") return "2024-01-01";
      if (column === "fechaFinMesConsumo") return "2024-01-31";
      if (column === "codigoTipoLectura") return "";
      if (column === "consumoEnWhP1") return '"1.234,5"';
      return "7";
    });

    const parsed = parseCsv(`${GAS_CONSUMPTION_COLUMNS.join(",")}\n${row.join(",")}`);
    const result = normalizeApoloSipsCsv(parsed, "CONSUMOS", "GAS");

    expect(result.hasData).toBe(true);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].consumoEnWhP1).toBe(1234.5);
    expect(result.rows[0].codigoTipoLectura).toBeNull();
  });
});
