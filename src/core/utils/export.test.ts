import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Table } from "@tanstack/react-table";
import { exportRowsToExcel, NOTES_COLUMN_ID } from "./export";

const mocks = vi.hoisted(() => ({
  json_to_sheet: vi.fn((rows: Record<string, unknown>[]) => {
    void rows;
    return {} as Record<string, unknown>;
  }),
  book_new: vi.fn(() => ({})),
  book_append_sheet: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: mocks.json_to_sheet,
    book_new: mocks.book_new,
    book_append_sheet: mocks.book_append_sheet,
  },
  writeFile: mocks.writeFile,
}));

/** Minimal stand-in exposing just what the exporter reads off a table. */
const buildTable = (
  columns: { id: string; accessorKey?: string; header?: unknown }[],
) =>
  ({
    getColumn: (id: string) => {
      const column = columns.find((c) => c.id === id);
      if (!column) return undefined;
      return {
        columnDef: {
          accessorKey: column.accessorKey,
          header: column.header,
        },
      };
    },
  }) as unknown as Table<unknown>;

/** Rows handed to json_to_sheet, i.e. what actually lands in the workbook. */
const sheetRows = (): Record<string, unknown>[] =>
  mocks.json_to_sheet.mock.calls[0]?.[0] ?? [];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exportRowsToExcel", () => {
  test("exports unassigned comparison commissions distinctly from zero", async () => {
    const table = buildTable([{ id: "Comisión", accessorKey: "comision" }]);
    await exportRowsToExcel({ table, rows: [{ comision: { fijo: null, indexado: 0 } }], selectedColumnIds: ["Comisión"], name: "Comparativas" });
    expect(sheetRows()[0]).toEqual({ "Comisión Fijo": "Sin asignar", "Comisión Indexado": 0 });
  });

  test("resolves values through each column's accessorKey", async () => {
    const table = buildTable([
      { id: "Cliente", accessorKey: "client_name" },
      { id: "CUPS", accessorKey: "CUPS" },
    ]);

    const result = await exportRowsToExcel({
      table,
      rows: [{ client_name: "Acme SL", CUPS: ["ES001", "ES002"] }],
      selectedColumnIds: ["Cliente", "CUPS"],
      name: "Trámites",
    });

    expect(result.success).toBe(true);
    // Arrays collapse to a comma-separated cell, as in the on-screen export.
    expect(sheetRows()[0]).toEqual({
      Cliente: "Acme SL",
      CUPS: "ES001, ES002",
    });
  });

  test("carries the virtual notes column, which has no table counterpart", async () => {
    const table = buildTable([{ id: "Cliente", accessorKey: "client_name" }]);

    await exportRowsToExcel({
      table,
      rows: [
        { client_name: "Acme SL", notes: "12/03/26 — Ana: Cambio de titular" },
        { client_name: "Beta SL", notes: "" },
      ],
      selectedColumnIds: ["Cliente", NOTES_COLUMN_ID],
      name: "Trámites",
    });

    expect(sheetRows()[0][NOTES_COLUMN_ID]).toBe(
      "12/03/26 — Ana: Cambio de titular",
    );
    // Empty notes read as "---", matching how the exporter renders other blanks.
    expect(sheetRows()[1][NOTES_COLUMN_ID]).toBe("---");
  });

  test("formats dates and blank cells the same way as the visible export", async () => {
    const table = buildTable([
      { id: "Fecha de Activación", accessorKey: "activation_date" },
      { id: "Proveedor", accessorKey: "provider" },
    ]);

    await exportRowsToExcel({
      table,
      rows: [{ activation_date: "2026-03-12T00:00:00.000Z", provider: null }],
      selectedColumnIds: ["Fecha de Activación", "Proveedor"],
      name: "Liquidez",
    });

    expect(sheetRows()[0]["Fecha de Activación"]).toMatch(/2026/);
    expect(sheetRows()[0]["Proveedor"]).toBe("---");
  });

  test("uses a static column header as the Excel header when present", async () => {
    const table = buildTable([
      { id: "Comercial", accessorKey: "sales_name", header: "Comercial" },
      // Header rendered by a component: the id is the only stable name.
      { id: "Estado", accessorKey: "status", header: () => null },
    ]);

    await exportRowsToExcel({
      table,
      rows: [{ sales_name: "Ana", status: "pending" }],
      selectedColumnIds: ["Comercial", "Estado"],
      name: "Trámites",
    });

    expect(Object.keys(sheetRows()[0])).toEqual(["Comercial", "Estado"]);
  });
});
