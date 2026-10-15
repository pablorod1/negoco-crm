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
    const other = "24.33 €\nUn 6.3% menos en tu factura eléctrica\nTarifa actual TMAE 3\nReducción respecto a tu factura actual 6.3%";
    expect(notAnInvoice(other)?.kind).toBe("comparison");
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

describe("luz y gas", () => {
  const gasInvoice = `Factura de gas Nº factura G-1 Total factura 194,43 €
Peaje de acceso RL.2 Consumo 112 m3 x 11,018 kWh/m3 = 1.234 kWh
Impuesto especial sobre hidrocarburos 1.234 kWh x 0,00234 €/kWh`;
  const lightInvoice = `Nº factura F-1 Total factura 44,07 € Peaje de acceso: 2.0TD Potencia contratada 3,45 kW
Origen: ciclo combinado de gas natural 17,9 %`;

  test("una factura de gas en una comparativa de luz, y al revés", () => {
    expect(notAnInvoice(gasInvoice)?.kind).toBe("other_energy");
    expect(notAnInvoice(lightInvoice, { energy: "gas" })?.kind).toBe("other_energy");
  });

  test("cada una en su comparativa pasa; «gas natural» del origen de la luz no la hace de gas", () => {
    expect(notAnInvoice(gasInvoice, { energy: "gas" })).toBeNull();
    expect(notAnInvoice(lightInvoice)).toBeNull();
  });

  test("los mensajes de una comparativa de gas piden la factura de gas", () => {
    expect(notAnInvoice("Estudio comparativo sin validez contractual", { energy: "gas" })?.message).toMatch(/factura de gas/);
  });
});
