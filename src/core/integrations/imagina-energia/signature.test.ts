import { describe, expect, test } from "vitest";
import {
  canonicalizeJson,
  signImaginaPayload,
  stripCallbackSignature,
  verifyImaginaSignature,
} from "./signature";

describe("Imagina callback signature", () => {
  test("canonicalizes objects with sorted keys", () => {
    expect(canonicalizeJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":2}',
    );
  });

  test("validates a signed payload and strips _callback_signature", () => {
    const payload = {
      request_id: 123,
      referencia_externa: "REF",
      result: { codigo: 1, texto: "Aprobado" },
      _callback_signature: { version: "v1", signature: "ignored" },
    };
    const timestamp = "1772552356";
    const publicUrl =
      "https://tenant.negoco.test/api/webhooks/imagina-energia/scoring";
    const signature = signImaginaPayload("seed", timestamp, publicUrl, payload);

    const result = verifyImaginaSignature({
      payload: {
        ...payload,
        _callback_signature: { version: "v1", signature, timestamp },
      },
      headers: {},
      publicUrl,
      seedKey: "seed",
      nowMs: Number(timestamp) * 1000,
    });

    expect(result.valid).toBe(true);
    expect(stripCallbackSignature(payload)).not.toHaveProperty(
      "_callback_signature",
    );
  });

  test("rejects invalid signatures", () => {
    const timestamp = "1772552356";
    const result = verifyImaginaSignature({
      payload: { request_id: 123 },
      headers: {
        "X-Signature": "v1=bad",
        "X-Signature-Timestamp": timestamp,
      },
      publicUrl:
        "https://tenant.negoco.test/api/webhooks/imagina-energia/scoring",
      seedKey: "seed",
      nowMs: Number(timestamp) * 1000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid signature");
  });

  test("rejects old timestamps", () => {
    const timestamp = "1772552356";
    const publicUrl =
      "https://tenant.negoco.test/api/webhooks/imagina-energia/scoring";
    const payload = { request_id: 123 };
    const signature = signImaginaPayload("seed", timestamp, publicUrl, payload);

    const result = verifyImaginaSignature({
      payload,
      headers: {
        "X-Signature": `v1=${signature}`,
        "X-Signature-Timestamp": timestamp,
      },
      publicUrl,
      seedKey: "seed",
      nowMs: (Number(timestamp) + 301) * 1000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Signature timestamp outside tolerance");
  });
});
