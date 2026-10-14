// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { naturgyInvoice } from "./fixtures";
import { verifyReading } from "./verify-reading";

process.env.VERCEL_AI_GATEWAY_API_KEY ??= "test";
const context = { tenantSlug: "test", jobType: "invoice_verification" as const };

/** Un Jev de mentira: da a cada afirmación la probabilidad que diga `probabilityOf`. */
function fakeDecide(kind: { choice: string; probability: number }, probabilityOf: (statement: string) => number) {
  return vi.fn(async ({ questions }: { questions: Record<string, { type: string; instructions: string }> }) => ({
    answers: Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        question.type === "choice"
          ? { type: "choice", choice: kind.choice, probabilities: { [kind.choice]: kind.probability } }
          : { type: "boolean", probability: probabilityOf(question.instructions) },
      ]),
    ),
    usage: { inputTokens: 5000, outputTokens: 0, totalTokens: 5000 },
  }));
}

describe("verifyReading", () => {
  test("marks as doubtful what the checker does not see in the invoice", async () => {
    const decideFn = fakeDecide({ choice: "factura", probability: 0.99 }, (statement) => (statement.includes("consumo del periodo de valle") ? 0.02 : 0.97));
    const recordUsage = vi.fn(async () => {});
    const check = await verifyReading({ text: "…", reading: naturgyInvoice, context, decideFn: decideFn as never, recordUsage });
    expect(check).toEqual({ notInvoice: null, doubtfulFields: ["consumptionKwh.P3"] });
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ succeeded: true, costUsd: expect.any(Number) }));
  });

  test("believes it is not an invoice only when it is sure", async () => {
    const sure = fakeDecide({ choice: "estudio_comparativo", probability: 0.95 }, () => 0.9);
    const unsure = fakeDecide({ choice: "contrato", probability: 0.6 }, () => 0.9);
    const run = (decideFn: unknown) =>
      verifyReading({ text: "…", reading: naturgyInvoice, context, decideFn: decideFn as never, recordUsage: async () => {} });
    expect((await run(sure))?.notInvoice).toBe("comparison");
    expect((await run(unsure))?.notInvoice).toBeNull();
  });

  test("if the checker fails, the study goes on", async () => {
    const decideFn = vi.fn(async () => {
      throw new Error("Gateway caída");
    });
    const recordUsage = vi.fn(async () => {});
    await expect(verifyReading({ text: "…", reading: naturgyInvoice, context, decideFn: decideFn as never, recordUsage })).resolves.toBeNull();
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ succeeded: false }));
  });
});
