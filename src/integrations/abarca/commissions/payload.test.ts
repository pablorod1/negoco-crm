import { describe, expect, it } from "vitest";
import {
  buildAbarcaPayload,
  describeRemoteDifferences,
  remoteMatches,
} from "./payload";

describe("Abarca commission payload", () => {
  const catalog = [
    { comercializadora: "ENDESA", segmento: "luz_20td" as const, bloqueada: false },
    { comercializadora: "ENDESA GRANDES CUENTAS", segmento: "luz_pymes" as const, bloqueada: false },
  ];

  it("expands mappings and keeps explicit zero", () => {
    const result = buildAbarcaPayload(
      [{ comercializadora_id: "endesa", segment: "luz_20td", commission_type: "percent", commission_value: 0 }],
      [{ comercializadora_id: "endesa", segment: "luz_20td", abarca_name: "ENDESA" }],
      [],
      catalog,
    );
    expect(result.rules).toEqual([{ comercializadora: "ENDESA", segmento: "luz_20td", tipo: "porcentaje", valor: 0 }]);
    expect(result.retiringKeys.size).toBe(0);
  });

  it("retires a previously managed rule with a numeric zero", () => {
    const result = buildAbarcaPayload([], [], [{
      abarca_name: "ENDESA", segment: "luz_20td", commission_type: "fixed", desired_value: 12,
    }], catalog);
    expect(result.rules[0]).toMatchObject({ tipo: "fija", valor: 0 });
    expect(result.retiringKeys.size).toBe(1);
  });

  it("does not export blocked or unavailable combinations", () => {
    const result = buildAbarcaPayload(
      [{ comercializadora_id: "endesa", segment: "gas", commission_type: "percent", commission_value: 10 }],
      [{ comercializadora_id: "endesa", segment: "gas", abarca_name: "ENDESA" }],
      [], catalog,
    );
    expect(result.rules).toEqual([]);
    expect(result.unresolved).toHaveLength(1);
  });

  it("accepts confirmed zero rows as matching withdrawals", () => {
    const expected = [{ comercializadora: "ENDESA", segmento: "luz_20td" as const, tipo: "fija" as const, valor: 0 }];
    expect(remoteMatches(expected, expected)).toBe(true);
  });

  it("keeps a withdrawal unresolved when the old combination is unavailable", () => {
    const result = buildAbarcaPayload([], [], [{
      abarca_name: "REPSOL", segment: "gas", commission_type: "percent", desired_value: 10,
    }], catalog);
    expect(result.rules).toEqual([]);
    expect(result.unresolved[0]).toContain("retirada no disponible");
  });

  it("describes missing and mismatched remote values", () => {
    const expected = [
      {
        comercializadora: "REPSOL",
        segmento: "luz_20td" as const,
        tipo: "porcentaje" as const,
        valor: 75,
      },
      {
        comercializadora: "ENDESA",
        segmento: "gas" as const,
        tipo: "fija" as const,
        valor: 20,
      },
    ];
    const actual = [
      {
        comercializadora: "Repsol",
        segmento: "luz_20td" as const,
        tipo: "porcentaje" as const,
        valor: 70,
      },
    ];

    expect(describeRemoteDifferences(expected, actual)).toEqual([
      "REPSOL / luz_20td: CRM 75% · Comparador 70%",
      "ENDESA / gas: CRM 20 € · Comparador sin configurar",
    ]);
  });
});
