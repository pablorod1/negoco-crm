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
});
