import { describe, expect, test } from "vitest";
import { signInboundQueue, verifyInboundQueue } from "./inbound-queue";

describe("inbound queue signature", () => {
  test("only the server, with the webhook secret, can continue a queue", () => {
    const body = JSON.stringify({ tenantSlug: "beenergy", ids: ["a", "b"], approvedBy: "u1", receivedOn: "2026-10-16" });
    const signature = signInboundQueue(body, "whsec_secreto");
    expect(verifyInboundQueue(body, signature, "whsec_secreto")).toBe(true);
    expect(verifyInboundQueue(body.replace('"a"', '"c"'), signature, "whsec_secreto")).toBe(false);
    expect(verifyInboundQueue(body, signature, "otro")).toBe(false);
    expect(verifyInboundQueue(body, null, "whsec_secreto")).toBe(false);
    expect(verifyInboundQueue(body, "nohex", "whsec_secreto")).toBe(false);
  });
});
