import type { InvoiceExtraction } from "./invoice-schema";

/*
 * Importes y precios de dos facturas reales de Beenergy (septiembre de 2026).
 * Titular, NIF, CUPS y dirección son inventados.
 */

export const naturgyInvoice: InvoiceExtraction = {
  supplierName: "Naturgy Iberia",
  invoiceNumber: "TEST-0001",
  issueDate: "2026-09-15",
  billingPeriod: { from: "2026-08-13", to: "2026-09-13", days: 32 },
  cups: "ES0021000000000001RK0F",
  holder: { name: "Cliente de Prueba", taxId: "12345678Z" },
  supplyAddress: "Calle Ficticia 1, Alicante",
  accessTariff: "2.0TD",
  pricing: "fixed",
  hasSelfConsumption: false,
  contractedKw: { P1: 3.45, P2: 3.45 },
  consumptionKwh: { P1: 95, P2: 110, P3: 162 },
  powerLines: [
    { period: "P1", kw: 3.45, days: 32, pricePerKwDay: 0.12303, amount: 13.58, originalPrice: null },
    { period: "P2", kw: 3.45, days: 32, pricePerKwDay: 0.037337, amount: 4.12, originalPrice: null },
  ],
  energyLines: [{ period: "ALL", kwh: 367, pricePerKwh: 0.1099, amount: 40.33 }],
  energyDiscounts: [],
  otherElectricityLines: [],
  socialBonusLines: [{ days: 32, pricePerDay: 0.024688, amount: 0.79 }],
  electricityTax: { base: 58.82, ratePercent: 5.112696, amount: 3.01 },
  meterRental: { days: 32, pricePerDay: 0.02663, amount: 0.85 },
  otherTaxableLines: [],
  vatExemptLines: [],
  taxableBase: 62.68,
  vat: { ratePercent: 21, base: 62.68, amount: 13.16 },
  total: 75.84,
};

export const iberdrolaInvoice: InvoiceExtraction = {
  supplierName: "Iberdrola Clientes",
  invoiceNumber: "TEST-0002",
  issueDate: "2026-09-02",
  billingPeriod: { from: "2026-08-03", to: "2026-08-31", days: 28 },
  cups: "ES0031000000000002BZ0F",
  holder: { name: "Cliente de Prueba", taxId: "B26833335" },
  supplyAddress: "Calle Ficticia 2, Valencia",
  accessTariff: "2.0TD",
  pricing: "fixed",
  hasSelfConsumption: false,
  contractedKw: { P1: 3.4, P2: 3.4 },
  consumptionKwh: { P1: 40, P2: 35, P3: 55 },
  powerLines: [
    { period: "P1", kw: 3.4, days: 28, pricePerKwDay: 0.12463, amount: 11.86, originalPrice: null },
    { period: "P2", kw: 3.4, days: 28, pricePerKwDay: 0.062986, amount: 6, originalPrice: null },
  ],
  energyLines: [
    { period: "ALL", kwh: 13, pricePerKwh: 0.156125, amount: 2.03 },
    { period: "ALL", kwh: 117, pricePerKwh: 0.156125, amount: 18.27 },
  ],
  energyDiscounts: [
    { description: "Descuento sobre consumo 5%", amount: -1.02 },
    { description: "Descuento sobre consumo 20%", amount: -4.06 },
  ],
  otherElectricityLines: [],
  socialBonusLines: [{ days: 28, pricePerDay: 0.024688, amount: 0.69 }],
  electricityTax: { base: 33.77, ratePercent: 5.11269632, amount: 1.73 },
  meterRental: { days: 32, pricePerDay: 0.02663, amount: 0.85 },
  otherTaxableLines: [
    { description: "Pack Iberdrola Hogar", amount: 8.3 },
    { description: "Descuento Pack Iberdrola Hogar", amount: -4.15 },
  ],
  vatExemptLines: [],
  taxableBase: 40.5,
  vat: { ratePercent: 21, base: 40.5, amount: 8.51 },
  total: 49.01,
};
