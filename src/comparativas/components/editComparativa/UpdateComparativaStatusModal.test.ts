import { describe, expect, test } from "vitest";
import {
  getAllowedStatusOptions,
  getStatusUpdatePayload,
  hasMissingCommission,
} from "./status-options";

const values = (
  status: Parameters<typeof getAllowedStatusOptions>[0],
  {
    role = "1",
    complete = true,
    review = true,
    hasTramite = false,
  }: {
    role?: string;
    complete?: boolean;
    review?: boolean;
    hasTramite?: boolean;
  } = {},
) =>
  getAllowedStatusOptions(
    status,
    {
      role,
      permissions: {
        "comparisons.study.complete": complete,
        "comparisons.study.review": review,
      },
    },
    hasTramite,
  ).map(({ value }) => value);

describe("getAllowedStatusOptions", () => {
  test("matches pending transitions and the completion permission", () => {
    expect(values("pending")).toEqual(["completed", "rejected"]);
    expect(values("pending", { complete: false })).toEqual([]);
  });

  test("processing exposes the same study actions as pending", () => {
    expect(values("processing")).toEqual(["completed", "rejected"]);
    expect(values("processing", { complete: false })).toEqual([]);
  });

  test("matches review transitions and the review permission", () => {
    expect(values("awaiting_review")).toEqual(["completed"]);
    expect(values("awaiting_review", { review: false })).toEqual([]);
  });

  test("matches completed transitions", () => {
    expect(values("completed")).toEqual(["rechazado_cliente"]);
    expect(values("completed", { hasTramite: true })).toEqual([
      "processed",
      "rechazado_cliente",
    ]);
  });

  test.each(["rejected", "rechazado_cliente"] as const)(
    "only exposes valid recovery transitions from %s",
    (status) => {
      const expectedOtherRejection =
        status === "rejected" ? "rechazado_cliente" : "rejected";

      expect(values(status)).toEqual([
        "pending",
        "completed",
        expectedOtherRejection,
      ]);
      expect(values(status, { complete: false })).toEqual([
        "pending",
        expectedOtherRejection,
      ]);
      expect(values(status, { role: "2" })).toEqual([]);
    },
  );

  test("processed comparisons have no outgoing transitions", () => {
    expect(values("processed")).toEqual([]);
  });

  test("only sends a tramite for the processed transition", () => {
    expect(
      getStatusUpdatePayload({
        status: "processed",
        commissions: null,
        tramiteId: "tramite-1",
      }),
    ).toEqual({
      status: "processed",
      comissions: undefined,
      tramite_id: "tramite-1",
    });

    expect(
      getStatusUpdatePayload({
        status: "pending",
        commissions: null,
        tramiteId: "tramite-1",
      }),
    ).toEqual({
      status: "pending",
      comissions: undefined,
      tramite_id: undefined,
    });
  });

  test("accepts zero commissions and rejects missing or non-finite values", () => {
    expect(hasMissingCommission([0, 0])).toBe(false);
    expect(hasMissingCommission([10, undefined])).toBe(true);
    expect(hasMissingCommission([Number.NaN, 10])).toBe(true);
    expect(hasMissingCommission([Number.POSITIVE_INFINITY])).toBe(true);
  });
});
