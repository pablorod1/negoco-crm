import { z } from "zod";

/**
 * Plantilla de lectura de un Excel de precios. La IA la escribe una vez por
 * formato y nuestro código la aplica a las celdas; las cifras nunca pasan por
 * la IA. Se guarda por comercializadora y se reutiliza mientras el formato no
 * cambie.
 */

/** Campos que una tabla puede leer de las celdas o fijar como constante. */
export const RECIPE_FIELDS = [
  // Qué tarifa es.
  "productName",
  // Lo que distingue variantes del mismo producto sin campo propio (con GdO,
  // verde): se añade al nombre.
  "variant",
  "level",
  "accessTariff",
  "territory",
  "channel",
  "segment",
  // Condiciones. Las bandas se pueden dar ya separadas o como texto
  // («P1 <= 10kW», «1.000 - 5.000», «Inicio Enero27»), que interpreta el código.
  "powerBand",
  "consumptionBand",
  "minKw",
  "maxKw",
  "minKwh",
  "maxKwh",
  "startMonth",
  // Fecha de fin del precio fijo; con la de inicio da la duración.
  "contractEnd",
  "termMonths",
  // Precios.
  "energyP1",
  "energyP2",
  "energyP3",
  "powerP1",
  "powerP2",
  "powerMargin",
  "feeMinMwh",
  "feeMaxMwh",
  "discountText",
  // Constantes de la tabla.
  "energyUnit",
  "powerUnit",
  "singlePrice",
  "powerMode",
  "pricing",
  "ancillaryIncluded",
  "feeOnPower",
  // Comisiones.
  "commissionAmount",
  "commissionType",
  "feeBase",
] as const;

export type RecipeField = (typeof RECIPE_FIELDS)[number];

const SourceSchema = z.object({
  field: z.enum(RECIPE_FIELDS),
  column: z
    .string()
    .nullable()
    .describe(
      "Columna de la que se lee el valor en cada fila de datos (letra: «C», «AA»). Con repeat se mueve con cada copia; «$Q» no se mueve",
    ),
  cell: z
    .string()
    .nullable()
    .describe(
      "Celda fija de la que se lee el valor («B5»), por ejemplo un título de bloque. Con repeat se mueve con cada copia; «C$40» solo se mueve de columna y «$C$40» nunca, como en Excel",
    ),
  value: z
    .string()
    .nullable()
    .describe("Valor constante si no sale de ninguna celda («N1», «2.0TD», «eur_kw_year», «true»)"),
});

export const RecipeTableSchema = z.object({
  sheet: z.string().describe("Nombre exacto de la hoja"),
  description: z.string().describe("Qué contiene la tabla, en pocas palabras"),
  kind: z
    .enum(["prices", "power", "commissions"])
    .describe(
      "prices: filas con precios (y quizá potencia); power: solo potencia, que se une a las de precios por producto, nivel, territorio y tarifa; commissions: comisiones",
    ),
  firstRow: z.number().int().describe("Primera fila de datos (número de fila de Excel)"),
  lastRow: z.number().int().describe("Última fila de datos"),
  startText: z
    .string()
    .nullable()
    .describe(
      "Texto fijo de la fila de título o cabecera justo antes de los datos, para encontrarlos aunque se muevan filas",
    ),
  rowFilter: z
    .object({ column: z.string(), pattern: z.string() })
    .nullable()
    .describe("Solo las filas cuya celda en esa columna cumple la expresión regular (p. ej. columna B y «^2\\.?0»)"),
  fillDown: z
    .array(z.string())
    .describe("Columnas cuyo valor vale para las filas de debajo mientras estén vacías"),
  repeat: z
    .array(
      z.object({
        columnShift: z.number().int().describe("Columnas a la derecha (0 si no se mueve)"),
        rowShift: z.number().int().describe("Filas hacia abajo (0 si no se mueve)"),
        values: z.array(z.object({ field: z.enum(RECIPE_FIELDS), value: z.string().nullable() })),
      }),
    )
    .describe(
      "Copias del mismo bloque desplazadas: a la derecha (niveles N1/N2/N3 en paralelo) o hacia abajo (el mismo bloque para otro producto o territorio), con los valores que cambian",
    ),
  sources: z.array(SourceSchema),
  expect: z
    .array(z.object({ cell: z.string(), text: z.string() }))
    .describe("Dos o tres celdas de título o cabecera que identifican la tabla, con su texto"),
});

export const SheetRecipeSchema = z.object({
  supplierName: z.string().nullable(),
  validFrom: z
    .object({ cell: z.string(), sheet: z.string() })
    .nullable()
    .describe("Celda con la fecha (o el texto con las fechas) desde la que valen los precios"),
  validTo: z
    .object({ cell: z.string(), sheet: z.string() })
    .nullable()
    .describe("Celda con la fecha hasta la que valen, si el documento la da"),
  tables: z.array(RecipeTableSchema),
  skippedSheets: z
    .array(z.object({ sheet: z.string(), reason: z.string() }))
    .describe("Hojas que no se leen y por qué (indexado, gas, simulador, 3.0TD…)"),
  skippedRanges: z
    .array(z.object({ sheet: z.string(), range: z.string(), reason: z.string() }))
    .optional()
    .describe(
      "Bloques de una hoja con 2.0TD que no se leen a propósito (un indexado al lado de los fijos): rango «AO18:BB72» y por qué",
    ),
});

export type SheetRecipe = z.infer<typeof SheetRecipeSchema>;
export type RecipeTable = z.infer<typeof RecipeTableSchema>;
export type RecipeSource = z.infer<typeof SourceSchema>;
