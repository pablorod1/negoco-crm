import { describe, expect, test } from "vitest";
import { isValidCups } from "@/comparador/extraction/identifiers";
import { findLeaks, redactInvoiceText, repairOcrCups } from "./redact";

// Factura inventada con la forma que da pdftotext; ningún dato es real.
const INVOICE = `Comercializadora Ficticia S.A.
NIF A12345674
MARIA PRUEBA INVENTADA
Calle Falsa 123, 3º B
46001 VALENCIA
Titular: MARIA PRUEBA INVENTADA
DNI/NIF: 12345678Z
Email: maria.prueba@example.com   Teléfono: 612 345 678
CUPS: ES 0021 0000 0000 0001 RK 0F
Nº contrato 123456789012
Dirección de suministro: Calle Falsa 123
Peaje de acceso: 2.0TD
Periodo de facturación: 13/08/2026 - 13/09/2026 (32 días)
Término potencia P1 3,450 kW x 32 días x 0,123030 €/kW día 13,58 €
Consumo electricidad 367 kWh x 0,109900 €/kWh 40,33 €
Financiación de Bono Social 32 días x 0,024688 €/día 0,79 €
Impuesto electricidad 58,82 € x 5,112696 % 3,01 €
IVA (21%) 62,68 € x 21% 13,16 €
Total a pagar 75,84 €
Domiciliado en ES68 2100 2291 7401 0071 ****
Gracias por confiar en nosotros`;

describe("redactInvoiceText", () => {
  const result = redactInvoiceText(INVOICE);

  test("keeps every line the calculation needs", () => {
    for (const fragment of [
      "Peaje de acceso: 2.0TD",
      "(32 días)",
      "3,450 kW x 32 días x 0,123030 €/kW día 13,58 €",
      "367 kWh x 0,109900 €/kWh 40,33 €",
      "0,024688 €/día 0,79 €",
      "58,82 € x 5,112696 % 3,01 €",
      "Total a pagar 75,84 €",
    ]) {
      expect(result.text).toContain(fragment);
    }
  });

  test("removes names, addresses and every identifier", () => {
    for (const fragment of [
      "MARIA",
      "PRUEBA",
      "INVENTADA",
      "Falsa",
      "VALENCIA",
      "12345678Z",
      "example.com",
      "612 345 678",
      "0021 0000",
      "123456789012",
      "2100 2291",
    ]) {
      expect(result.text).not.toContain(fragment);
    }
    expect(result.leaks).toEqual([]);
  });

  test("collects identifiers locally with valid control digits", () => {
    expect(result.identifiers.cups).toEqual(["ES0021000000000001RK0F"]);
    expect(result.identifiers.taxId).toEqual(["A12345674", "12345678Z"]);
    expect(result.holderTokens).toEqual(["MARIA", "PRUEBA", "INVENTADA"]);
  });

  test("drops lines without figures or invoice terms", () => {
    expect(result.text).not.toContain("Gracias por confiar");
    expect(result.droppedLines).toBeGreaterThan(0);
  });

  test("flags capitalized sequences that might be a name nobody labeled", () => {
    const unlabeled = redactInvoiceText(
      "JUAN NADIE NINGUNO 3 kW\nTotal a pagar 10,00 €",
    );
    expect(unlabeled.suspiciousLines).toBe(1);
    expect(unlabeled.text).toContain("Total a pagar 10,00 €");
  });
});

describe("formats seen in real invoices (invented data)", () => {
  const result = redactInvoiceText(`Nº de factura: 26XXAGN000012345
Fecha de emisión: 17 de septiembre de 2026
Cl De Ejemplo, 9
Ps. 1 Pta. 3
28001, Madrid (Madrid)
35, 2-ZD
ES*******************999
• Nº de mandato: NCXXXXX2807202600000000000001234567
ID de cuenta: A-C12D3456
Período de facturación:
Del 29 de julio de 2026 al 24 de agosto de 2026
Consumo (P1)
9,00 kWh
0,1290000 €/kWh
1,16 €
Peaje de acceso:
2.0TD
P1: 3,300 kW
13,906`);

  test("drops abbreviated addresses, postal codes with comma and door numbers", () => {
    for (const fragment of ["Ejemplo", "Ps. 1", "Pta", "28001", "Madrid", "2-ZD"]) {
      expect(result.text).not.toContain(fragment);
    }
  });

  test("hides masked IBANs, mandates and account codes", () => {
    for (const fragment of ["*****999", "NCXXXXX", "C12D3456", "26XXAGN"]) {
      expect(result.text).not.toContain(fragment);
    }
    expect(result.leaks).toEqual([]);
  });

  test("still keeps dates, periods, tariff and readings", () => {
    for (const fragment of [
      "17 de septiembre de 2026",
      "Del 29 de julio de 2026 al 24 de agosto de 2026",
      "Consumo (P1)",
      "0,1290000 €/kWh",
      "2.0TD",
      "P1: 3,300 kW",
      "13,906",
    ]) {
      expect(result.text).toContain(fragment);
    }
  });

  test("drops greetings with the customer's name and hides 3-2-2-2 phones", () => {
    const greeting = redactInvoiceText(
      "NOMBREFALSO, tienes 5,01 €\nHola Inventado, tu factura\nLlámanos al 925 00 00 00\nTotal 49,01 €",
    );
    expect(greeting.text).not.toContain("NOMBREFALSO");
    expect(greeting.text).not.toContain("Inventado");
    expect(greeting.text).not.toContain("925 00 00 00");
    expect(greeting.text).toContain("Total 49,01 €");
  });

  test("a town ending in «dia» is not mistaken for the unit «día»", () => {
    const town = redactInvoiceText("46000 FALSADIA\n46000 FALSADIA, VALENCIA\nTotal 10,00 €");
    expect(town.text).toBe("Total 10,00 €");
  });

  test("the final check reports any address that slips through", () => {
    expect(findLeaks("Calle Inventada 4\nTotal 10,00 €")).toContain("address");
    expect(findLeaks("28000, Inventada")).toContain("address");
  });
});

describe("decimals and concept labels", () => {
  test("keeps the electricity tax rate and long decimals", () => {
    const result = redactInvoiceText(
      "Importe IEE · 5,11269632 % s/ (14,73) 0,75 €\nPrecio 0,123456789 €/kWh",
    );
    expect(result.text).toContain("5,11269632 %");
    expect(result.text).toContain("0,123456789 €/kWh");
    expect(result.leaks).toEqual([]);
  });

  test("keeps concept labels without figures", () => {
    const result = redactInvoiceText("Financiación del bono social\n0,79 €");
    expect(result.text).toContain("Financiación del bono social");
  });
});

describe("findLeaks", () => {
  test("detects identifier-shaped leftovers", () => {
    expect(findLeaks("Total 10,00 €")).toEqual([]);
    expect(findLeaks("CUPS ES0021000000000001RK0F")).toContain("cups");
    expect(findLeaks("NIF 12345678Z")).toContain("taxId");
    expect(findLeaks("ES68 2100 2291 7401 0071 ****")).toContain("iban");
  });
});

describe("repairOcrCups", () => {
  test("letters read in place of digits are fixed only if the control letters match", () => {
    // ES0021000000000000RC: CUPS de ejemplo con sus letras de control correctas.
    const valid = "ES0021000000000000RC";
    expect(isValidCups(valid)).toBe(true);
    expect(repairOcrCups("CUPS: ESOO21OOOOOOOOOOOORC")).toBe(`CUPS: ${valid}`);
    expect(repairOcrCups(`CUPS: ${valid}OF`)).toBe(`CUPS: ${valid}0F`);
    // Un punto frontera mal leído se separa; el CUPS vale sin él.
    expect(repairOcrCups(`${valid}O9P TNP: 21,00%`)).toBe(`${valid} O9P TNP: 21,00%`);
    // Con una cifra cambiada, las letras no cuadran: se queda como estaba.
    expect(repairOcrCups("CUPS: ESOO21OOOOOOOOOOO1RC")).toBe("CUPS: ESOO21OOOOOOOOOOO1RC");
  });
});
