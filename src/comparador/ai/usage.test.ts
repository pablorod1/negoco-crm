import type { Client } from "@libsql/client";
import { describe, expect, test, vi } from "vitest";
import { buildGatewayOptions } from "./gateway";
import { recordAiUsage, type AiUsageEvent } from "./usage";

const event: AiUsageEvent = {
  context: {
    tenantSlug: "test",
    jobType: "invoice_extraction",
    userId: "user-1",
    subjectId: "CMP-1",
  },
  model: "google/gemini-3.8-flash-lite",
  inputTokens: 6000,
  outputTokens: 1000,
  totalTokens: 7000,
  costUsd: 0.0043,
  generationId: "gen_1",
  succeeded: true,
  error: null,
};

describe("buildGatewayOptions", () => {
  test("always asks for zero data retention, no training and spend tags", () => {
    expect(buildGatewayOptions(event.context)).toEqual({
      zeroDataRetention: true,
      disallowPromptTraining: true,
      tags: ["tenant:test", "job:invoice_extraction"],
      user: "user-1",
    });
  });

  test("omits the user when there is none", () => {
    expect(
      buildGatewayOptions({ tenantSlug: "test", jobType: "classification" }),
    ).not.toHaveProperty("user");
  });
});

describe("recordAiUsage", () => {
  test("stores one row per call in the control database", async () => {
    const execute = vi.fn(async () => ({ rows: [] }));

    await recordAiUsage(event, { execute } as unknown as Client);

    expect(execute).toHaveBeenCalledTimes(1);
    const [{ sql, args }] = execute.mock.calls[0] as unknown as [
      { sql: string; args: unknown[] },
    ];
    expect(sql).toContain("INSERT INTO ai_usage_events");
    expect(args.slice(1)).toEqual([
      "test",
      "invoice_extraction",
      "google/gemini-3.8-flash-lite",
      "CMP-1",
      "user-1",
      6000,
      1000,
      7000,
      0.0043,
      "gen_1",
      1,
      null,
    ]);
  });

  test("never throws when the control database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      execute: vi.fn(async () => {
        throw new Error("unavailable");
      }),
    } as unknown as Client;

    await expect(recordAiUsage(event, client)).resolves.toBeUndefined();
  });
});
