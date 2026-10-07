import { z } from "zod";

const price = z.number().nullable();

/**
 * Una fila de precios tal como la extrae la IA. Es plana a propósito: un
 * anexo de Iberdrola trae ~45 filas de 2.0TD y cada llave anidada cuesta
 * tokens de salida. Las cifras van tal cual en el documento, con su unidad;
 * la conversión y el fragmento de origen los pone nuestro código.
 */
const ExtractedRateSchema = z.object({
  productName: z
    .string()
    .describe("Nombre comercial del producto, sin el nivel ni la tarifa de acceso"),
  accessTariff: z.string().describe("2.0TD"),
  pricing: z.enum(["fixed", "indexed", "flat", "other"]),
  level: z
    .string()
    .nullable()
    .describe("Nivel, tramo de margen o columna de comisión (N1, Agencia, Alto, T0, Nivel 2…)"),
  territory: z.enum(["peninsula", "baleares", "canarias", "ceuta_melilla"]).nullable(),
  channel: z.enum(["acquisition", "renewal", "both"]).nullable(),
  segment: z.string().nullable().describe("Doméstico, pyme, autónomo, comunidad…"),
  minKw: price,
  maxKw: price,
  minKwh: price.describe("Consumo anual mínimo, en kWh"),
  maxKwh: price.describe("Consumo anual máximo, en kWh"),
  startFrom: z
    .string()
    .nullable()
    .describe("Si el precio depende del mes de inicio del suministro, YYYY-MM-DD"),
  startTo: z.string().nullable(),
  months: z.number().int().nullable().describe("Duración o permanencia en meses"),
  powerMode: z.enum(["fixed", "regulated", "regulated_plus", "not_stated"]),
  powerUnit: z.enum(["eur_kw_day", "eur_kw_month", "eur_kw_year"]).nullable(),
  powerP1: price,
  powerP2: price,
  powerMargin: price.describe("Margen sobre la potencia regulada, €/kW·año"),
  energyUnit: z.enum(["eur_kwh", "cent_kwh", "eur_mwh"]).nullable(),
  energyP1: price,
  energyP2: price,
  energyP3: price,
  singlePrice: z
    .boolean()
    .describe("true si el producto tiene un único precio de energía para todas las horas"),
  ancillaryIncluded: z
    .boolean()
    .nullable()
    .describe("false si los servicios de ajuste se cobran aparte («sin SS.AA.»)"),
  feeMinMwh: price.describe("Fee mínimo que suma el comercial, €/MWh"),
  feeMaxMwh: price,
  feeOnPower: z.boolean().describe("El fee también se puede poner en la potencia"),
  discounts: z.array(
    z.object({
      kind: z.enum(["energy_percent", "power_percent", "fixed_amount", "other"]),
      value: price,
      months: z.number().int().nullable(),
      conditional: z.boolean(),
      text: z.string().describe("Máximo 80 caracteres"),
    }),
  ),
});

/** Lo que la IA extrae de un anexo de precios. */
export const RateDocumentSchema = z.object({
  supplierName: z
    .string()
    .nullable()
    .describe("Comercializadora que publica los precios"),
  documentKind: z.enum(["prices", "commissions", "prices_and_commissions", "other"]),
  validFrom: z
    .string()
    .nullable()
    .describe("Primer día de vigencia de los precios, YYYY-MM-DD"),
  validTo: z
    .string()
    .nullable()
    .describe("Último día de vigencia, YYYY-MM-DD, si el documento lo indica"),
  partialUpdate: z
    .boolean()
    .describe(
      "true si el documento solo anuncia cambios en algunos precios (por ejemplo «nuevo precio de la energía») y no la tarifa completa",
    ),
  rates: z.array(ExtractedRateSchema),
  commissions: z.array(
    z.object({
      productName: z.string().nullable(),
      accessTariff: z
        .string()
        .nullable()
        .describe("Tarifa de acceso de la sección donde aparece la comisión"),
      pricing: z
        .enum(["fixed", "indexed"])
        .nullable()
        .describe("Si la comisión es de productos de precio fijo o indexados"),
      level: z.string().nullable(),
      channel: z.enum(["acquisition", "renewal", "both"]).nullable(),
      minKwh: price,
      maxKwh: price,
      ruleType: z.enum(["fixed", "per_mwh", "fee_share"]),
      feeBase: z
        .enum(["energy", "power"])
        .nullable()
        .describe("Con fee_share: si es un porcentaje del fee de energía o del de potencia"),
      amount: z.number(),
    }),
  ),
  skipped: z
    .array(z.string())
    .describe(
      "Lo que el documento trae y no se ha extraído, en frases cortas: «3.0TD y 6.1TD», «tarifas de gas», «productos indexados»…",
    ),
});

export type RateDocumentExtraction = z.infer<typeof RateDocumentSchema>;
export type ExtractedRate = z.infer<typeof ExtractedRateSchema>;
export type ExtractedCommission = RateDocumentExtraction["commissions"][number];

/** Clasificación barata antes de extraer, para no gastar en documentos que no sirven. */
export const RateDocumentClassificationSchema = z.object({
  supplierName: z.string().nullable(),
  hasPrices: z.boolean(),
  hasCommissions: z.boolean(),
  accessTariffs: z
    .array(z.string())
    .describe("Tarifas de acceso con precios en el documento: 2.0TD, 3.0TD, 6.1TD, RL1…"),
  pricing: z.array(z.enum(["fixed", "indexed", "flat", "other"])),
});

export type RateDocumentClassification = z.infer<
  typeof RateDocumentClassificationSchema
>;
