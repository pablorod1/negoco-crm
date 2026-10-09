// @vitest-environment node
import { describe, expect, test } from "vitest";
import type { Block } from "tesseract.js";
import { redactInvoiceText } from "@/comparador/redaction/redact";
import { COLUMN_BREAK, layoutWords } from "./ocr";

/** Un bloque de Tesseract con palabras en (x, y); 20 px de alto cada una. */
const block = (words: [string, number, number][]): Block =>
  ({
    paragraphs: [
      {
        lines: [
          {
            words: words.map(([text, x, y]) => ({ text, bbox: { x0: x, x1: x + text.length * 10, y0: y, y1: y + 20 } })),
          },
        ],
      },
    ],
  }) as unknown as Block;

describe("layoutWords", () => {
  test("a wide gap between words at the same height is a column break", () => {
    const text = layoutWords([
      block([
        ["JUAN", 50, 100],
        ["PEREZ", 100, 100],
        ["GARCIA", 160, 100],
        ["Potencia", 600, 102],
        ["punta:", 690, 101],
        ["4,6", 755, 100],
        ["kW", 790, 100],
      ]),
    ]);
    expect(text).toBe(`JUAN PEREZ GARCIA${COLUMN_BREAK}Potencia punta: 4,6 kW`);
  });

  test("separator rules read as dashes or bars also split columns", () => {
    expect(layoutWords([block([["JUAN", 50, 100], ["PEREZ", 100, 100], ["—", 160, 100], ["Total", 175, 100], ["40,11", 230, 100], ["€", 285, 100]])])).toBe(
      `JUAN PEREZ${COLUMN_BREAK}Total 40,11 €`,
    );
  });
});

describe("redacting OCR columns", () => {
  test("a name sharing a row with figures is dropped, the figures stay", () => {
    const { text } = redactInvoiceText(`JUAN PEREZ GARCIA${COLUMN_BREAK}Potencia punta: 4,6 kW\nEDIFICIO GARZA${COLUMN_BREAK}30203 CARTAGENA (MURCIA)`, {
      fromImage: true,
    });
    expect(text).toBe("Potencia punta: 4,6 kW");
  });

  test("known holder words are hidden even without a label", () => {
    const { text } = redactInvoiceText("Contrato a nombre de Pérez: energía 100 kWh", { knownHolderTokens: ["Pérez"] });
    expect(text).not.toMatch(/Pérez/);
  });
});

describe("ocrImages", () => {
  test("gives up with a clear error instead of hanging past the limit", async () => {
    const { ocrImages, OcrTimeoutError } = await import("./ocr");
    const sharp = (await import("sharp")).default;
    const blank = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(ocrImages([blank], 1)).rejects.toBeInstanceOf(OcrTimeoutError);
  });
});
