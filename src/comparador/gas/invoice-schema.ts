import { z } from "zod";

const amount = z.number().describe("Importe en euros, tal cual en la factura");
const lines = (describe: string) => z.array(z.object({ description: z.string(), amount })).describe(describe);

/**
 * Lo que la IA extrae de una factura de gas natural. Como en la luz, se
 * piden las líneas tal como aparecen para poder comprobar cada importe.
 */
export const GasInvoiceExtractionSchema = z.object({
  supplierName: z
    .string()
    .nullable()
    .describe("Comercializadora que emite la factura. Nunca la distribuidora (Nedgia, Madrileña Red de Gas, Nortegas, Redexis…)"),
  invoiceNumber: z.string().nullable(),
  issueDate: z.string().nullable().describe("Fecha de emisión, YYYY-MM-DD"),
  billingPeriod: z
    .object({
      from: z.string().nullable().describe("YYYY-MM-DD"),
      to: z.string().nullable().describe("YYYY-MM-DD"),
      days: z.number().int(),
    })
    .nullable(),
  cups: z.string().nullable().describe("CUPS del gas sin espacios"),
  holder: z.object({
    name: z.string().nullable(),
    taxId: z.string().nullable().describe("DNI, NIE o CIF del titular"),
  }),
  supplyAddress: z.string().nullable(),
  accessTariff: z.string().nullable().describe("Peaje de acceso: RL.1, RL.2, RL.3, RL.4… (o TUR.1, TUR.2… si es la tarifa de último recurso)"),
  regulatedTur: z.boolean().describe("true si es la tarifa de último recurso (TUR) de una comercializadora de referencia"),
  pricing: z
    .enum(["fixed", "indexed", "flat", "unknown"])
    .describe("indexed si el precio del gas depende del mercado (MIBGAS, TTF, Henry Hub); flat si es una cuota fija al mes"),
  consumptionKwh: z.number().nullable().describe("Consumo del periodo facturado en kWh"),
  consumptionM3: z.number().nullable().describe("Consumo del periodo en m³, si la factura lo da"),
  conversionFactor: z.number().nullable().describe("Factor de conversión de m³ a kWh (kWh/m³), si la factura lo da"),
  fixedTermLines: z
    .array(
      z.object({
        days: z.number().nullable().describe("Días facturados de esa línea, si los da"),
        pricePerDay: z.number().nullable().describe("€/día; null si la factura da el precio al mes o al año"),
        originalPrice: z
          .object({
            unit: z.enum(["mes", "año"]),
            price: z.number(),
            months: z.number().nullable().describe("Meses facturados, si los indica (por ejemplo 1,03)"),
          })
          .nullable()
          .describe("Solo si el término fijo va en €/mes o €/año: el precio tal cual. Nosotros lo pasamos a días"),
        amount,
      }),
    )
    .describe("Término fijo (o de disponibilidad): una línea por tramo de fechas o concepto"),
  energyLines: z
    .array(z.object({ kwh: z.number(), pricePerKwh: z.number(), amount }))
    .describe("Término variable (o de energía): una línea por tramo de fechas o concepto, en €/kWh"),
  discounts: z
    .array(
      z.object({
        description: z.string(),
        appliesTo: z.enum(["energy", "fixed", "both", "amount"]).describe("Sobre el término variable, el fijo, los dos, o un importe en euros"),
        amount,
      }),
    )
    .describe("Descuentos, en negativo. Si la factura dice cuánto duran, cópialo en la descripción («durante 3 meses»)"),
  hydrocarbonTax: z
    .object({
      kwh: z.number().nullable(),
      ratePerKwh: z.number().nullable().describe("€/kWh, por ejemplo 0,00234"),
      amount,
    })
    .nullable()
    .describe("Impuesto especial sobre hidrocarburos"),
  meterRental: z
    .object({
      days: z.number().nullable(),
      pricePerDay: z.number().nullable().describe("€/día; null si la factura no lo imprime"),
      amount,
    })
    .nullable(),
  regulatedLines: lines(
    "Cargos de la distribuidora o regulados que cobra cualquier comercializadora y no son el término fijo ni el variable: canon IRC (instalación receptora común), cánones de la distribuidora, cuota del Gestor Técnico del Sistema (GTS), tasa de la CNMC, coste de transporte",
  ),
  otherTaxableLines: lines("Servicios que se pagan cada factura (mantenimiento, asistencia, packs, seguros con IVA) y sus descuentos"),
  oneOffLines: lines(
    "Cargos de una sola vez: inspección periódica, alta, enganche, acometida, depósito, derechos de conexión, regularizaciones. Llevan IVA pero no se repiten",
  ),
  vatExemptLines: lines("Conceptos sin IVA: suman al total fuera de la base"),
  taxableBase: z.number().nullable().describe("Base imponible del IVA (la suma, si hay varias); nunca el importe del IVA"),
  vatLines: z
    .array(z.object({ ratePercent: z.number().describe("Por ejemplo 21"), base: z.number(), amount }))
    .describe("IVA: una línea por tipo. En 2026 hay facturas con el gas al 10 % y el contador o el canon al 21 %"),
  total: z.number().nullable().describe("Total de la factura"),
});

export type GasInvoiceExtraction = z.infer<typeof GasInvoiceExtractionSchema>;
