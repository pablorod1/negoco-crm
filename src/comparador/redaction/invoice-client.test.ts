import { describe, expect, test } from "vitest";
import { clientFromInvoiceText } from "./invoice-client";

// Textos inventados: DNI, CIF e IBAN con su control correcto, de ejemplo.
const INVOICE = `Iberdrola Clientes, S.A.U. CIF A95758389
Atención al cliente 900 225 235 · WhatsApp 644 555 666
Titular: MARIA JOSE LOPEZ GARCIA NIF: 12345678Z
Dirección de suministro: CL MAYOR 5 3ºB
28013 MADRID
Teléfono de contacto: 612 345 678
Domiciliación bancaria: ES91 2100 0418 4502 0005 1332
Potencia P1 4,6 kW x 30 días x 0,108192 €/kW día 14,93 €`;

describe("clientFromInvoiceText", () => {
  test("reads the holder, the supply address and the direct debit", () => {
    expect(clientFromInvoiceText(INVOICE)).toEqual({
      name: "Maria Jose",
      lastName: "Lopez Garcia",
      kind: "Particular",
      documentNumber: "12345678Z",
      email: null,
      phone: "612345678",
      iban: "ES91 2100 0418 4502 0005 1332",
      address: "Cl Mayor 5 3ºb",
      postalCode: "28013",
      city: "Madrid",
      province: null,
    });
  });

  test("a company holder keeps its name whole and takes the CIF on its line", () => {
    const client = clientFromInvoiceText(`Endesa Energía S.A. CIF A81948077
Razón social: TALLERES PEREZ S.L. CIF B12345674`);
    expect(client).toMatchObject({ name: "TALLERES PEREZ S.L.", lastName: null, kind: "Empresa", documentNumber: "B12345674" });
  });

  test("never takes the supplier's CIF, its service numbers or a masked IBAN", () => {
    const client = clientFromInvoiceText(`Iberdrola Clientes, S.A.U. CIF A95758389
Atención al cliente 600 111 222
Domiciliación: ES91 **** **** **** **** 1332
Total factura 69,62 €`);
    expect(client).toBeNull();
  });
});
