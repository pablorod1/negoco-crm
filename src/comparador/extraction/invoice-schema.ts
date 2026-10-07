import { z } from "zod";

const amount = z.number().describe("Importe en euros, tal cual en la factura");

/**
 * Lo que la IA extrae de una factura de luz 2.0TD. Se piden las líneas tal
 * como aparecen, no solo los totales, para poder comprobar cada importe.
 */
export const InvoiceExtractionSchema = z.object({
  supplierName: z
    .string()
    .nullable()
    .describe("Comercializadora que emite la factura"),
  invoiceNumber: z.string().nullable(),
  issueDate: z.string().nullable().describe("Fecha de emisión, YYYY-MM-DD"),
  billingPeriod: z
    .object({
      from: z.string().nullable().describe("YYYY-MM-DD"),
      to: z.string().nullable().describe("YYYY-MM-DD"),
      days: z.number().int(),
    })
    .nullable(),
  cups: z.string().nullable().describe("CUPS sin espacios"),
  holder: z.object({
    name: z.string().nullable(),
    taxId: z.string().nullable().describe("DNI, NIE o CIF del titular"),
  }),
  supplyAddress: z.string().nullable(),
  accessTariff: z
    .string()
    .nullable()
    .describe("Peaje de acceso: 2.0TD, 3.0TD, 6.1TD..."),
  pricing: z
    .enum(["fixed", "indexed", "unknown"])
    .describe("indexed si el precio de la energía depende del mercado"),
  hasSelfConsumption: z.boolean().describe("Autoconsumo o compensación de excedentes"),
  contractedKw: z.object({
    P1: z.number().nullable(),
    P2: z.number().nullable(),
  }),
  consumptionKwh: z
    .object({
      P1: z.number().nullable(),
      P2: z.number().nullable(),
      P3: z.number().nullable(),
    })
    .describe("Consumo del periodo facturado en cada periodo horario"),
  powerLines: z
    .array(
      z.object({
        period: z.enum(["P1", "P2"]),
        kw: z.number(),
        days: z.number(),
        pricePerKwDay: z.number(),
        amount,
        originalPrice: z
          .object({
            unit: z.enum(["kW·mes", "kW·año"]),
            price: z.number(),
            months: z
              .number()
              .nullable()
              .describe("Meses facturados, si la factura los indica (por ejemplo 1,10)"),
          })
          .nullable()
          .describe(
            "Solo si la factura da la potencia en €/kW·mes o €/kW·año: el precio tal cual. Nosotros lo pasamos a días",
          ),
      }),
    )
    .describe("Una línea por periodo y tramo de fechas"),
  energyLines: z
    .array(
      z.object({
        period: z
          .enum(["P1", "P2", "P3", "ALL"])
          .describe("ALL si la factura usa un único precio para todos"),
        kwh: z.number(),
        pricePerKwh: z.number(),
        amount,
      }),
    )
    .describe("Una línea por periodo y tramo de fechas, en €/kWh"),
  energyDiscounts: z
    .array(z.object({ description: z.string(), amount }))
    .describe("Descuentos sobre la energía, en negativo"),
  otherElectricityLines: z
    .array(z.object({ description: z.string(), amount }))
    .describe(
      "Otros importes sujetos al impuesto eléctrico: margen de intermediación, excesos de potencia, energía reactiva…",
    ),
  socialBonusLines: z
    .array(
      z.object({
        days: z.number().nullable(),
        pricePerDay: z
          .number()
          .nullable()
          .describe("€/día; null si la factura no lo imprime o lo cobra al mes"),
        amount,
      }),
    )
    .describe("Financiación del bono social; puede venir partida por fechas"),
  electricityTax: z
    .object({
      base: z.number(),
      ratePercent: z.number().describe("Por ejemplo 5.11269632"),
      amount,
    })
    .nullable(),
  meterRental: z
    .object({
      days: z.number().nullable(),
      pricePerDay: z
        .number()
        .nullable()
        .describe("€/día; null si la factura no lo imprime"),
      amount,
    })
    .nullable(),
  otherTaxableLines: z
    .array(z.object({ description: z.string(), amount }))
    .describe(
      "Servicios, packs y sus descuentos: llevan IVA pero no impuesto eléctrico",
    ),
  vatExemptLines: z
    .array(z.object({ description: z.string(), amount }))
    .describe("Conceptos sin IVA, por ejemplo seguros: suman al total fuera de la base"),
  taxableBase: z.number().nullable(),
  vat: z
    .object({
      ratePercent: z.number().describe("Por ejemplo 21"),
      base: z.number(),
      amount,
    })
    .nullable(),
  total: z.number().nullable().describe("Total de la factura"),
});

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;
