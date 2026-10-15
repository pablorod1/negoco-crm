import { describe, expect, test } from "vitest";
import { indexMonthProblem } from "./index-history";
import { monthsBetween, parseHistoryText, parseMonth } from "./index-history-text";

describe("index history text", () => {
  test("reads the usual ways of writing a month", () => {
    expect(parseMonth("2025-05")).toBe("2025-05");
    expect(parseMonth("05/2025")).toBe("2025-05");
    expect(parseMonth("5-25")).toBe("2025-05");
    expect(parseMonth("may-25")).toBe("2025-05");
    expect(parseMonth("Mayo 2025")).toBe("2025-05");
    expect(parseMonth("Septiembre de 2025")).toBe("2025-09");
    expect(parseMonth("set-25")).toBe("2025-09");
    expect(parseMonth("13/2025")).toBeNull();
    expect(parseMonth("Mes")).toBeNull();
  });

  test("pasted rows from a sheet, in €/MWh, with a header and a single-price month", () => {
    const text = ["Mes\tP1\tP2\tP3", "may-2025\t142,1\t118,7\t95,3", "Junio 2025 150.2 124 98.8", "jul-25;130"].join("\n");
    const parsed = parseHistoryText(text, "eur_mwh");
    expect(parsed.problems).toEqual([]);
    expect(parsed.months).toEqual([
      { month: "2025-05", energy: { P1: 0.1421, P2: 0.1187, P3: 0.0953 } },
      { month: "2025-06", energy: { P1: 0.1502, P2: 0.124, P3: 0.0988 } },
      { month: "2025-07", energy: { P1: 0.13, P2: 0.13, P3: 0.13 } },
    ]);
  });

  test("says which lines it cannot read", () => {
    const parsed = parseHistoryText("may-2025\t0,14\t0,12\nTotal 0,13 0,12 0,11", "eur_kwh");
    expect(parsed.months).toEqual([]);
    expect(parsed.problems).toHaveLength(2);
  });

  test("a price in the wrong unit is caught before saving", () => {
    expect(indexMonthProblem({ month: "2025-05", energy: { P1: 14.2, P2: 11.8, P3: 9.5 } })).toMatch(/€\/MWh o céntimos/);
    expect(indexMonthProblem({ month: "2025-05", energy: { P1: 0.142, P2: 0.118, P3: 0.095 } })).toBeNull();
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

test("el histórico de Eleia: meses en inglés y €/MWh con punto decimal", () => {
  expect(parseMonth("Aug-26")).toBe("2026-08");
  expect(parseMonth("Jan-26")).toBe("2026-01");
  expect(parseMonth("Dec-25")).toBe("2025-12");
  const parsed = parseHistoryText("Fecha\tP1\tP2\tP3\nSep-25\t176.01\t119.39\t106.99\nDec-25\t215.15\t162.75\t118.66", "eur_mwh");
  expect(parsed.problems).toEqual([]);
  expect(parsed.months).toEqual([
    { month: "2025-09", energy: { P1: 0.17601, P2: 0.11939, P3: 0.10699 } },
    { month: "2025-12", energy: { P1: 0.21515, P2: 0.16275, P3: 0.11866 } },
  ]);
});
