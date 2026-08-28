import { describe, expect, test } from "vitest";
import { AbarcaWebhookSchema } from "./abarca.types";

describe("AbarcaWebhookSchema", () => {
  test("accepts null optional fields without relaxing required ids", () => {
    const result = AbarcaWebhookSchema.safeParse({
      ide: 123,
      crm_id: 456,
      numero: null,
      numero_cups: null,
      email: null,
      potencia_contratada: null,
      cambio_titularidad: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numero).toBeNull();
      expect(result.data.numero_cups).toBeNull();
      expect(result.data.email).toBeNull();
      expect(result.data.potencia_contratada).toBeNull();
      expect(result.data.cambio_titularidad).toBeNull();
    }
  });

  test("still requires ide and crm_id", () => {
    const result = AbarcaWebhookSchema.safeParse({
      numero: null,
      crm_id: 456,
    });

    expect(result.success).toBe(false);
  });

  test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid crm_id %s",
    (crmId) => {
      const result = AbarcaWebhookSchema.safeParse({
        ide: 123,
        crm_id: crmId,
      });

      expect(result.success).toBe(false);
    },
  );

  // Los documentos ya no se validan en el schema: un fichero ilegible no debe
  // tumbar la entrega entera. Los resuelve `abarca-documents` uno a uno.
  test.each([
    { name: "empty", value: "" },
    { name: "malformed", value: "not/base64%%%" },
    {
      name: "non-canonical",
      value: Buffer.from("%PDF-1.7").toString("base64").replace(/=+$/, ""),
    },
    {
      name: "a PNG in a DNI field",
      value: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]).toString("base64"),
    },
    {
      name: "an oversized document",
      value: Buffer.alloc(64 * 1024).toString("base64"),
    },
  ])("keeps the study when a document is $name", ({ value }) => {
    const result = AbarcaWebhookSchema.safeParse({
      ide: 123,
      crm_id: 456,
      comparativa_pdf: value,
      dni_photo_front: value,
    });

    expect(result.success).toBe(true);
  });

  test("accepts a staged document reference from the ingest proxy", () => {
    const result = AbarcaWebhookSchema.safeParse({
      ide: 123,
      crm_id: 456,
      dni_photo_back: {
        path: "abarca-inbox/tenant/comparison-1/delivery-1/dni_photo_back.png",
        url: "https://storage.example/staged.png",
        bytes: 2048,
        content_type: "image/png",
      },
    });

    expect(result.success).toBe(true);
  });
});
