import { describe, expect, test } from "vitest";
import { notAnInvoice } from "./document-kind";

// Textos inventados con la forma de los documentos reales.
const INVOICE = "Nº factura: [CODIGO]\nPeriodo de facturación: 13/08/2026 - 13/09/2026\nPeaje de acceso: 2.0TD\nTotal a pagar 75,84 €";

describe("notAnInvoice", () => {
  test("an invoice is an invoice, even one that explains «tu factura con…»", () => {
    expect(notAnInvoice(INVOICE)).toBeNull();
    expect(notAnInvoice(`${INVOICE}\nEL DESGLOSE DE TU FACTURA CON UNA EXPLICACIÓN`)).toBeNull();
  });

  test("a supply contract (Axpo)", () => {
    const text = "Fecha Oferta\n23-09-2026\nCONTRATO DE SUMINISTRO DE ENERGÍA ELÉCTRICA\nCondiciones Particulares y a las Condiciones Generales\nFactura:";
    expect(notAnInvoice(text)?.kind).toBe("contract");
  });

  test("another supplier's comparison (Gana)", () => {
    const text = "Tu factura actual\nTu factura con Gana Energía\n*Este estudio comparativo es una estimación sin validez contractual.";
    expect(notAnInvoice(text)?.kind).toBe("comparison");
  });

  test("a price sheet without total or invoice number (Eleia)", () => {
    const text = "Precio del término de POTENCIA\nTARIFA 2.0TD\nP1 40,804413\nse aplicará en factura IVA reducido";
    expect(notAnInvoice(text)?.kind).toBe("price_sheet");
    // Con OCR, que falte el total puede ser que no se haya leído.
    expect(notAnInvoice(text, { fromImage: true })).toBeNull();
  });

  test("an invoice of another access tariff", () => {
    expect(notAnInvoice("Fecha de emisión: 16/09/2026\nTarifa de Acceso: 6.1TD\nImporte total 1.234,00 €")).toMatchObject({
      kind: "other_tariff",
      message: expect.stringContaining("6.1TD"),
    });
  });
});
