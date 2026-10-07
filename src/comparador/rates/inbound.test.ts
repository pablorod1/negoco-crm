// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  inboundIngestId,
  isTrustedSender,
  selectAttachments,
  tenantFromRecipients,
  verifySvixSignature,
} from "./inbound";

const SECRET = `whsec_${Buffer.from("secreto-de-prueba").toString("base64")}`;

function sign(id: string, timestamp: string, body: string) {
  const key = Buffer.from(SECRET.slice("whsec_".length), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

describe("verifySvixSignature", () => {
  const body = JSON.stringify({ type: "email.received" });
  const now = 1_791_400_000_000;
  const timestamp = String(now / 1000);

  test("accepts a valid signature, also among several", () => {
    const signature = sign("msg_1", timestamp, body);
    expect(
      verifySvixSignature({ secret: SECRET, id: "msg_1", timestamp, signatureHeader: signature, body, now }),
    ).toBe(true);
    expect(
      verifySvixSignature({
        secret: SECRET, id: "msg_1", timestamp, signatureHeader: `v1,otra ${signature}`, body, now,
      }),
    ).toBe(true);
  });

  test("rejects tampered bodies, old timestamps and missing headers", () => {
    const signature = sign("msg_1", timestamp, body);
    expect(
      verifySvixSignature({ secret: SECRET, id: "msg_1", timestamp, signatureHeader: signature, body: `${body} `, now }),
    ).toBe(false);
    expect(
      verifySvixSignature({
        secret: SECRET, id: "msg_1", timestamp, signatureHeader: signature, body, now: now + 10 * 60 * 1000,
      }),
    ).toBe(false);
    expect(
      verifySvixSignature({ secret: SECRET, id: null, timestamp, signatureHeader: signature, body, now }),
    ).toBe(false);
  });
});

describe("inbound routing", () => {
  test("the tenant is the local part of the address", () => {
    expect(tenantFromRecipients(["Beenergy <beenergy@tarifas.negococloud.es>"], "tarifas.negococloud.es")).toBe("beenergy");
    expect(tenantFromRecipients(["test+axpo@tarifas.negococloud.es"], "tarifas.negococloud.es")).toBe("test");
    expect(tenantFromRecipients(["info@negococloud.es"], "tarifas.negococloud.es")).toBeNull();
  });

  test("keeps annexes and drops signature images", () => {
    const selected = selectAttachments(
      [
        { id: "1", filename: "Precios B2B.xlsx", content_type: "application/vnd.ms-excel", size: 70_000 },
        { id: "2", filename: "image001.png", content_type: "image/png", content_disposition: "inline", size: 8_000 },
        { id: "3", filename: "GANA TRAMOS.png", content_type: "image/png", content_disposition: "attachment", size: 163_000 },
        { id: "4", filename: "contrato.docx", content_type: "application/msword", size: 30_000 },
        { id: "5", filename: "enorme.pdf", content_type: "application/pdf", size: 50_000_000 },
      ],
      20 * 1024 * 1024,
    );
    expect(selected.map(({ id }) => id)).toEqual(["1", "3"]);
  });

  test("trusted senders by address or domain", () => {
    const trusted = "@grupoeficience.com, soporte@visalia.es";
    expect(isTrustedSender("David <dmontesf@grupoeficience.com>", trusted)).toBe(true);
    expect(isTrustedSender("soporte@visalia.es", trusted)).toBe(true);
    expect(isTrustedSender("spam@example.com", trusted)).toBe(false);
    expect(isTrustedSender("dmontesf@grupoeficience.com", undefined)).toBe(false);
  });

  test("the same attachment always gets the same ingest id", () => {
    expect(inboundIngestId("email-1", "att-1")).toBe(inboundIngestId("email-1", "att-1"));
    expect(inboundIngestId("email-1", "att-1")).not.toBe(inboundIngestId("email-1", null));
    expect(inboundIngestId("email-1", "att-1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
