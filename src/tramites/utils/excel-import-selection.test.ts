import { describe, expect, test } from "vitest";
import type { MatchedCUPS } from "@/tramites/types";
import { getProcessableCups } from "./excel-import-selection";

const cups = "ES1234567890123456AB";
const matched = [
  { cups, tramiteId: "TR-1", liquidezStatus: "Pagado al Comercial" },
] as MatchedCUPS[];

describe("selección para importar liquidez y notas", () => {
  test("incluye un trámite ya pagado si tiene notas nuevas", () => {
    const result = getProcessableCups(
      matched,
      new Set([cups]),
      "Pagado al Comercial",
      {
        "TR-1": [{ message: "Nota nueva", isInternal: true }],
      },
    );
    expect(result).toEqual(matched);
  });

  test("permite importar solo notas sin seleccionar un estado", () => {
    const result = getProcessableCups(matched, new Set([cups]), null, {
      "TR-1": [{ message: "Nota nueva", isInternal: false }],
    });
    expect(result).toEqual(matched);
  });

  test("omite los trámites sin cambios", () => {
    expect(
      getProcessableCups(matched, new Set([cups]), "Pagado al Comercial", {}),
    ).toEqual([]);
    expect(
      getProcessableCups(matched, new Set(), null, {
        "TR-1": [{ message: "Nota nueva", isInternal: false }],
      }),
    ).toEqual([]);
  });
});
