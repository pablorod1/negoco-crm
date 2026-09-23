import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelFile, reparseWithColumn } from "./excel-import";

describe("importación de la columna Notas", () => {
  test("asocia las notas de cada fila con su CUPS al parsear y reprocesar", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["CUPS", "Notas", "Comisión"],
      ["ES1234567890123456AB", "Nota anterior\nNota nueva", 40],
      ["ES1234567890123457AB", "", 20],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Liquidez");
    const buffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;

    const parsed = await parseExcelFile(buffer);
    expect(parsed.notesColumn).toBe(1);
    expect(parsed.cups.map(({ cups, notes }) => ({ cups, notes }))).toEqual([
      { cups: "ES1234567890123456AB", notes: "Nota anterior\nNota nueva" },
      { cups: "ES1234567890123457AB", notes: "" },
    ]);

    const reparsed = await reparseWithColumn(buffer, 0, 0);
    expect(reparsed.cups.map((item) => item.notes)).toEqual(
      parsed.cups.map((item) => item.notes),
    );
  });
});
