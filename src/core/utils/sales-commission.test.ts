import { describe, expect, it } from "vitest";
import { calculateSalesPersonCommission } from "./sales-commission";
import type { UserCompanyCommission } from "@/core/types";

const rule = (segment: UserCompanyCommission["segment"], value: number): UserCompanyCommission => ({
  id: `${segment}-${value}`,
  user_id: "user",
  comercializadora_id: "supplier",
  segment,
  commission_type: "percent",
  commission_value: value,
  created_at: null,
  updated_at: null,
});

describe("calculateSalesPersonCommission", () => {
  it("selects the rule for the requested segment", () => {
    expect(calculateSalesPersonCommission({
      baseCommission: 100,
      supplierId: "supplier",
      segment: "luz_pymes",
      commissions: [rule("luz_20td", 10), rule("luz_pymes", 25)],
    })).toBe(25);
  });

  it("lets an explicit zero override win", () => {
    expect(calculateSalesPersonCommission({
      baseCommission: 100,
      supplierId: "supplier",
      segment: "gas",
      commissions: [rule("gas", 0)],
    })).toBe(0);
  });

  it("does not guess without a segment", () => {
    expect(calculateSalesPersonCommission({
      baseCommission: 100,
      supplierId: "supplier",
      commissions: [rule("gas", 10)],
    })).toBeNull();
  });
});
