import { describe, expect, test, vi } from "vitest";
import { daySums, MarketDataUnavailableError, omieAverages, parseOmieDay, periodOf } from "./omie";

const file = (date: string, prices: number[]) => {
  const [year, month, day] = date.split("-");
  return ["MARGINALPDBC;", ...prices.map((price, index) => `${year};${month};${day};${index + 1};${price};${price};`), "*", ""].join("\n");
};

describe("OMIE", () => {
  test("reads the Spanish price of each quarter hour", () => {
    expect(parseOmieDay("MARGINALPDBC;\n2026;09;01;1;180.24;175.5;\n".repeat(1) + Array(30).fill("2026;09;01;2;1;2;").join("\n"))?.[0]).toBe(175.5);
    expect(parseOmieDay("<!DOCTYPE html>")).toBeNull();
  });

  test("2.0TD periods: weekday hours, weekends and fixed national holidays", () => {
    expect(periodOf("2026-10-14", 7)).toBe("P3");
    expect(periodOf("2026-10-14", 8)).toBe("P2");
    expect(periodOf("2026-10-14", 10)).toBe("P1");
    expect(periodOf("2026-10-14", 14)).toBe("P2");
    expect(periodOf("2026-10-14", 19)).toBe("P1");
    expect(periodOf("2026-10-14", 22)).toBe("P2");
    expect(periodOf("2026-10-17", 12)).toBe("P3"); // sábado
    expect(periodOf("2026-10-12", 12)).toBe("P3"); // Fiesta Nacional
  });

  test("a day of 96 quarter hours, and clock-change days of 92 and 100", () => {
    const flat = (count: number) => Array.from({ length: count }, (_, index) => Math.floor(index / 4));
    // Miércoles: 8 h de P1 (32 cuartos), 8 de P2, 8 de P3.
    expect(daySums("2026-10-14", flat(96)).count).toEqual({ P1: 32, P2: 32, P3: 32 });
    // Domingo de marzo, 23 horas: todo P3.
    expect(daySums("2026-03-29", flat(92)).count).toEqual({ P1: 0, P2: 0, P3: 92 });
    // Precios por hora antes de octubre de 2025.
    expect(daySums("2025-09-03", Array(24).fill(50)).count).toEqual({ P1: 8, P2: 8, P3: 8 });
  });

  test("averages by period over date ranges, fetching each day once", async () => {
    const fetchDay = vi.fn(async (date: string) => parseOmieDay(file(date, Array.from({ length: 96 }, (_, index) => (index < 32 ? 40 : 100)))));
    const [week, wednesday] = await omieAverages(
      [
        { from: "2026-10-12", to: "2026-10-18" },
        { from: "2026-10-14", to: "2026-10-14" },
      ],
      fetchDay,
    );
    expect(fetchDay).toHaveBeenCalledTimes(7);
    // De 0 a 8 h, 40 €/MWh; el resto, 100: P3 laborable a 40, fines de semana mezclan.
    expect(wednesday).toEqual({ P1: 100, P2: 100, P3: 40 });
    expect(week.P1).toBe(100);
    expect(week.P3).toBeGreaterThan(40);
  });

  test("fails when too many days are missing", async () => {
    await expect(omieAverages([{ from: "2026-10-01", to: "2026-10-10" }], async () => null)).rejects.toBeInstanceOf(MarketDataUnavailableError);
  });
});
