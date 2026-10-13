import { describe, expect, test } from "vitest";
import { assessPower } from "./power";
import { rankOffers } from "./ranking";
import type { CostBreakdown } from "./types";

describe("assessPower", () => {
  test("flags demand more than 0.5 kW above the contracted power", () => {
    expect(assessPower({ P1: 2.2, P2: 2.2 }, [3.26, 1.1])).toEqual({
      status: "exceeded",
      contractedKw: 2.2,
      maxDemandKw: 3.26,
      suggestedKw: 3.3,
    });
  });

  test("adequate between 75 % of the contracted power and 0.5 kW above it", () => {
    expect(assessPower({ P1: 4.6, P2: 4.6 }, [4.0])?.status).toBe("adequate");
    // Sin excesos en 2.0TD, pasarse un poco solo hace saltar el limitador alguna vez.
    expect(assessPower({ P1: 3.45, P2: 3.45 }, [3.95])?.status).toBe("adequate");
    expect(assessPower({ P1: 3.45, P2: 3.45 }, [3.96])?.status).toBe("exceeded");
  });

  test("oversized below 75 % of the contracted power", () => {
    expect(assessPower({ P1: 5.75, P2: 5.75 }, [2.1])).toMatchObject({
      status: "oversized",
      suggestedKw: 2.1,
    });
  });

  test("no assessment without demand data", () => {
    expect(assessPower({ P1: 3.45, P2: 3.45 }, [])).toBeNull();
    expect(assessPower({ P1: 3.45, P2: 3.45 }, [0, 0])).toBeNull();
  });
});

const costOf = (total: number) => ({ total }) as CostBreakdown;

describe("rankOffers", () => {
  const current = costOf(571.03);

  test("orders by savings and breaks ties by commission", () => {
    const ranking = rankOffers(current, [
      { offer: "A", cost: costOf(600), commission: 50 },
      { offer: "B", cost: costOf(500), commission: 10 },
      { offer: "C", cost: costOf(500), commission: 30 },
    ]);

    expect(ranking.offers.map(({ offer }) => offer)).toEqual(["C", "B", "A"]);
    expect(ranking.offers[0].savings).toBe(71.03);
    expect(ranking.noSavings).toBe(false);
  });

  test("can order by commission", () => {
    const ranking = rankOffers(
      current,
      [
        { offer: "A", cost: costOf(600), commission: 50 },
        { offer: "B", cost: costOf(500), commission: null },
      ],
      "commission",
    );
    expect(ranking.offers.map(({ offer }) => offer)).toEqual(["A", "B"]);
  });

  test("warns when no offer saves money", () => {
    const ranking = rankOffers(current, [
      { offer: "A", cost: costOf(632.81), commission: null },
    ]);
    expect(ranking.offers[0].savings).toBe(-61.78);
    expect(ranking.noSavings).toBe(true);
  });
});
