import { describe, expect, test } from "vitest";
import { getInvoiceExtractionModels, INVOICE_EXTRACTION_MODELS } from "./models";

describe("getInvoiceExtractionModels", () => {
  test("uses the code default when the variable is absent or empty", () => {
    expect(getInvoiceExtractionModels({})).toEqual(INVOICE_EXTRACTION_MODELS);
    expect(getInvoiceExtractionModels({ COMPARADOR_INVOICE_MODELS: " , " })).toEqual(
      INVOICE_EXTRACTION_MODELS,
    );
  });

  test("reads a comma-separated cascade from the environment", () => {
    expect(
      getInvoiceExtractionModels({
        COMPARADOR_INVOICE_MODELS: " openai/gpt-5-mini , anthropic/claude-sonnet-5.5 ",
      }),
    ).toEqual(["openai/gpt-5-mini", "anthropic/claude-sonnet-5.5"]);
  });
});
