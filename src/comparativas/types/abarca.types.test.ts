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

  test.each([
    { name: "empty", value: "" },
    { name: "malformed", value: "not/base64%%%" },
    {
      name: "non-canonical",
      value: Buffer.from("%PDF-1.7").toString("base64").replace(/=+$/, ""),
    },
  ])("rejects $name document base64", ({ value }) => {
    const result = AbarcaWebhookSchema.safeParse({
      ide: 123,
      crm_id: 456,
      comparativa_pdf: value,
    });

    expect(result.success).toBe(false);
  });

  test.each([
    {
      field: "comparativa_pdf",
      value: Buffer.from("plain text").toString("base64"),
    },
    {
      field: "justo_titulo",
      value: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
    },
    {
      field: "dni_photo_front",
      value: Buffer.from("%PDF-1.7").toString("base64"),
    },
    {
      field: "dni_photo_back",
      value: Buffer.from("plain image").toString("base64"),
    },
  ])("rejects wrong magic bytes for $field", ({ field, value }) => {
    const result = AbarcaWebhookSchema.safeParse({
      ide: 123,
      crm_id: 456,
      [field]: value,
    });

    expect(result.success).toBe(false);
  });

  test("rejects a document over its decoded size limit", () => {
    const oversizedPdf = Buffer.alloc(8 * 1024 * 1024 + 1);
    oversizedPdf.write("%PDF-");

    const result = AbarcaWebhookSchema.safeParse({
      ide: 123,
      crm_id: 456,
      comparativa_pdf: oversizedPdf.toString("base64"),
    });

    expect(result.success).toBe(false);
  });

  test("rejects documents that exceed the decoded total budget", () => {
    const firstPdf = Buffer.alloc(7 * 1024 * 1024);
    const secondPdf = Buffer.alloc(7 * 1024 * 1024);
    firstPdf.write("%PDF-");
    secondPdf.write("%PDF-");

    const result = AbarcaWebhookSchema.safeParse({
      ide: 123,
      crm_id: 456,
      comparativa_pdf: firstPdf.toString("base64"),
      justo_titulo: secondPdf.toString("base64"),
    });

    expect(result.success).toBe(false);
  });
});
