import { looksIndexed, normalizeName } from "../names";
import type {
  ExtractedCommission,
  ExtractedRate,
  RateDocumentExtraction,
} from "../schema";
import { cellAt, cellIn, columnIndex, columnLetter, findSheet, type SheetCell, type SheetGrid } from "./grid";
import { energyOfTariff, normalizeGasTariff } from "@/comparador/gas/regulated";
import {
  parseBand,
  parseBoolean,
  parseChannel,
  parseDates,
  parseEnergyUnit,
  parseMonth,
  parseNumber,
  parsePowerUnit,
  parseTariff,
  parseTerm,
  parseTerritory,
} from "./parse";
import type { RecipeField, RecipeTable, SheetRecipe } from "./recipe";

/** Tabla de una plantilla con la fila de su texto ancla, que pone el código. */
export type StoredRecipeTable = RecipeTable & { anchorRow?: number | null };
/** Las plantillas guardadas antes del 2026-10-15 pueden no tener `skippedRanges`. */
export type StoredRecipe = Omit<SheetRecipe, "tables" | "skippedRanges"> & {
  tables: StoredRecipeTable[];
  skippedRanges?: SheetRecipe["skippedRanges"];
};

/** Algo de la plantilla que no encaja con el libro, y en qué hoja. */
export interface RecipeProblem {
  sheet: string | null;
  message: string;
}

export interface AppliedRecipe {
  extraction: RateDocumentExtraction;
  /** Fila de origen de cada tarifa, en el mismo orden que `extraction.rates`. */
  excerpts: string[];
  /** Hoja y fila de cada tarifa, en el mismo orden que `extraction.rates`. */
  sheets: string[];
  rows: number[];
  /** Filas idénticas a otra ya leída (el libro repite un bloque): leídas, pero no son otra tarifa. */
  repeated: { sheet: string; row: number }[];
  /** Lo que no encaja: si hay algo, la plantilla no sirve para este documento. */
  problems: RecipeProblem[];
  /** Avisos que no invalidan la plantilla (una tabla de comisiones vacía). */
  notes: string[];
}

const NUMERIC_FIELDS = new Set<RecipeField>([
  "energyP1", "energyP2", "energyP3", "powerP1", "powerP2", "powerMargin",
  "feeMinMwh", "feeMaxMwh", "minKw", "maxKw", "minKwh", "maxKwh", "commissionAmount",
]);

const key = (text: string | null | undefined) => (text ? normalizeName(text) : "");

/**
 * Cabecera de un bloque de precios indexados: el precio es una fórmula con el
 * mercado («PRECIO TÉRMINO B», que se suma al «TÉRMINO A» por el OMIE).
 */
const INDEXED_HEADER = /t[ée]rmino\s*b\b|indexad|omie|pool|f[óo]rmula|pass.?through/i;
const FIXED_HEADER = /\bfij[oa]s?\b|\bfixed\b/i;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

const findGrid = findSheet;

/** Fila en la que aparece el texto ancla de una tabla (la más cercana a la esperada). */
/** La IA a veces copia la coordenada del render («E=cents. €/kWh»). */
const withoutRef = (text: string) => text.replace(/^\s*[A-Z]{1,3}\d*\s*=\s*/, "");

export function locateAnchor(grid: SheetGrid, text: string, near: number | null): number | null {
  const wanted = key(withoutRef(text));
  if (!wanted) return null;
  const rows: number[] = [];
  grid.rows.forEach((row, index) => {
    if (row.some((cell) => cell && key(cell.text).includes(wanted))) rows.push(index + 1);
  });
  if (rows.length === 0) return null;
  if (near === null) return rows[0];
  return rows.reduce((best, row) => (Math.abs(row - near) < Math.abs(best - near) ? row : best));
}

/** Columna de una copia; «$Q», como en Excel, no se mueve (la potencia común a dos bloques). */
function shiftColumn(column: string, shift: number): string {
  const absolute = column.trim().startsWith("$");
  const letters = column.replace(/\$/g, "").trim();
  return absolute ? letters : columnLetter(columnIndex(letters) + shift);
}

/**
 * Celda de una copia. Como en Excel, «$» fija la columna o la fila: «C$40» se
 * mueve con las copias hacia la derecha pero no hacia abajo (la potencia de
 * Axpo está en una fila para todos los territorios). El ancla mueve siempre la
 * fila: si la comercializadora añade líneas encima, se mueve todo.
 */
function shiftCellRef(ref: string, columnShift: number, rowShift: number, anchorShift = 0): string {
  const match = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/i.exec(ref.trim());
  if (!match) return ref;
  const column = match[1] ? match[2] : shiftColumn(match[2], columnShift);
  return `${column}${Number(match[4]) + anchorShift + (match[3] ? 0 : rowShift)}`;
}

interface RowRecord {
  kind: RecipeTable["kind"];
  sheet: string;
  table: string;
  row: number;
  /** Territorio que dice la cabecera del bloque («Precios Energía - Peninsula»), si dice uno. */
  headerTerritory: ExtractedRate["territory"] | null;
  /** La cabecera del bloque dice que el precio es indexado, aunque la plantilla diga fijo. */
  headerIndexed: boolean;
  values: Partial<Record<RecipeField, SheetCell | string | null>>;
  excerpt: string;
}

/** Territorios que nombra un texto: «Baleares y Canarias» son dos. */
function territoriesIn(text: string): Set<ExtractedRate["territory"]> {
  const found = new Set<ExtractedRate["territory"]>();
  for (const part of text.split(/\s+y\s+|,|\/|-/)) {
    const parsed = parseTerritory(part);
    if (parsed) found.add(parsed);
  }
  return found;
}

/** El territorio que dicen las filas de encima de un bloque, si dicen uno solo. */
function blockTerritory(
  grid: SheetGrid,
  top: number,
  firstColumn: number,
  lastColumn: number,
): ExtractedRate["territory"] | null {
  const found = new Set<ExtractedRate["territory"]>();
  for (let row = Math.max(1, top - 4); row < top; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const cell = grid.rows[row - 1]?.[column];
      if (cell) for (const territory of territoriesIn(cell.text)) found.add(territory);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

/**
 * Si las filas de encima de las columnas de energía (y la de su izquierda,
 * donde Eleia escribe «PRECIO TERMINO B») dicen que el precio es indexado.
 * Si dicen también «fijo», manda lo que declare la plantilla. No se mira todo
 * el ancho de la tabla: Aletteo pone «Fijo» sobre la energía e «Indexado»
 * sobre el FEE del producto de al lado.
 */
function blockIndexed(grid: SheetGrid, top: number, firstColumn: number, lastColumn: number): boolean {
  let indexed = false;
  let fixed = false;
  for (let row = Math.max(1, top - 4); row < top; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const cell = grid.rows[row - 1]?.[column];
      if (!cell) continue;
      if (INDEXED_HEADER.test(cell.text)) indexed = true;
      if (FIXED_HEADER.test(cell.text)) fixed = true;
    }
  }
  return indexed && !fixed;
}

/** Nombre corto de una tabla para los avisos: la IA a veces escribe un párrafo. */
function tableName(table: RecipeTable): string {
  const description = table.description.replace(/\s+/g, " ").trim();
  return description.length > 60 ? `${description.slice(0, 59)}…` : description;
}

function rowExcerpt(grid: SheetGrid, row: number): string {
  const cells = (grid.rows[row - 1] ?? [])
    .map((cell, column) => (cell ? `${columnLetter(column)}=${cell.text}` : null))
    .filter(Boolean)
    .join(" · ");
  return `Hoja «${grid.name}», fila ${row}: ${cells}`.slice(0, 300);
}

/** Lee las filas de una tabla (y de sus copias desplazadas). */
function readTable(
  grid: SheetGrid,
  table: StoredRecipeTable,
  problems: RecipeProblem[],
  notes: string[],
): RowRecord[] {
  const label = `Hoja «${table.sheet}», ${tableName(table)}`;
  const fail = (message: string) => problems.push({ sheet: table.sheet, message: `${label}: ${message}` });

  // Las filas se mueven si la comercializadora añade un producto encima: el
  // texto ancla las vuelve a situar.
  let rowShift = 0;
  if (table.startText) {
    const found = locateAnchor(grid, table.startText, table.anchorRow ?? table.firstRow - 1);
    if (found === null) {
      fail(`no aparece «${table.startText}».`);
      return [];
    }
    if (table.anchorRow) rowShift = found - table.anchorRow;
  }

  for (const expected of table.expect) {
    // Una cifra no identifica una tabla: es un precio y cambia cada mes.
    const expectedText = withoutRef(expected.text);
    const numeric = parseNumber({ value: expectedText, text: expectedText });
    if (numeric.ok && numeric.value !== null) continue;
    const cell = cellAt(grid, shiftCellRef(expected.cell, 0, 0, rowShift));
    if (!cell || !key(cell.text).includes(key(expectedText))) {
      fail(`en ${expected.cell} se esperaba «${expected.text}» y hay «${cell?.text ?? "nada"}».`);
    }
  }

  const copies = [
    { columnShift: 0, rowShift: 0, values: [] as { field: RecipeField; value: string | null }[] },
    ...table.repeat.map((copy) => ({ ...copy, rowShift: copy.rowShift ?? 0 })),
  ];
  const records: RowRecord[] = [];
  const firstRow = table.firstRow + rowShift;
  const lastRow = table.lastRow + rowShift;
  const priceColumn =
    table.sources.find(({ field, column }) => column && (field === "energyP1" || field === "powerP1" || field === "commissionAmount"))
      ?.column ?? null;

  const sourceColumns = table.sources.flatMap(({ column }) =>
    column && !column.includes("$") ? [columnIndex(column)] : [],
  );
  const energyColumns = table.sources.flatMap(({ field, column }) =>
    column && !column.includes("$") && /^energyP\d$/.test(field) ? [columnIndex(column)] : [],
  );
  for (const copy of copies) {
    const filled = new Map<string, SheetCell>();
    // Un valor vacío en una copia («commissionAmount: null») no borra el
    // campo: es la manera en que la plantilla dice que se lee de la columna
    // desplazada, como en el bloque original. El Excel de Axpo perdía así los
    // niveles E y X. Tampoco lo borra la posición desplazada escrita como
    // valor («level: K5» para «C5», «powerP1: M» para «E»): la IA lo hizo así
    // con los niveles TDE de Eleia y cada copia leía el texto «K5».
    const readsShifted = (field: RecipeField, value: string | null) =>
      value === null ||
      table.sources.some(
        (source) =>
          source.field === field &&
          ((source.column && key(value) === key(shiftColumn(source.column, copy.columnShift))) ||
            (source.cell && key(value) === key(shiftCellRef(source.cell, copy.columnShift, copy.rowShift)))),
      );
    const overrides = new Map(
      copy.values
        .filter(({ field, value }) => !readsShifted(field, value) || !table.sources.some((source) => source.field === field && (source.column || source.cell)))
        .map(({ field, value }) => [field, value]),
    );
    const headerTerritory = sourceColumns.length
      ? blockTerritory(
          grid,
          firstRow + copy.rowShift,
          Math.min(...sourceColumns) + copy.columnShift,
          Math.max(...sourceColumns) + copy.columnShift,
        )
      : null;
    const headerIndexed = energyColumns.length
      ? blockIndexed(
          grid,
          firstRow + copy.rowShift,
          Math.max(0, Math.min(...energyColumns) - 1) + copy.columnShift,
          Math.max(...energyColumns) + copy.columnShift,
        )
      : false;
    // Si el bloque ha crecido (un producto nuevo al final), se siguen leyendo
    // las filas contiguas mientras traigan precio.
    let end = lastRow + copy.rowShift;
    const hasPrice = (row: number) => {
      if (!priceColumn) return false;
      const parsed = parseNumber(cellIn(grid, row, shiftColumn(priceColumn, copy.columnShift)));
      return parsed.ok && parsed.value !== null && parsed.value !== 0;
    };
    while (hasPrice(end + 1)) end++;

    for (let row = firstRow + copy.rowShift; row <= end; row++) {
      const read = (column: string) => {
        const shifted = shiftColumn(column, copy.columnShift);
        const cell = cellIn(grid, row, shifted);
        if (table.fillDown.includes(column)) {
          if (cell) filled.set(column, cell);
          else return filled.get(column) ?? null;
        }
        return cell;
      };
      for (const column of table.fillDown) read(column);

      if (table.rowFilter) {
        const cell = read(table.rowFilter.column);
        let pattern: RegExp;
        try {
          pattern = new RegExp(table.rowFilter.pattern, "i");
        } catch {
          fail(`el filtro «${table.rowFilter.pattern}» no es válido.`);
          return [];
        }
        // En una copia, la columna del filtro puede caer en el peaje antiguo
        // equivalente (Eleia: «RL.1» en C y «3.1» en K): vale si es el mismo
        // peaje que el de la columna sin desplazar.
        const sameTariff = () => {
          if (!cell || copy.columnShift === 0) return false;
          const original = cellIn(grid, row, table.rowFilter!.column.replace(/\$/g, ""));
          const here = parseTariff(cell.text)?.tariff;
          return Boolean(original && here && pattern.test(original.text) && parseTariff(original.text)?.tariff === here);
        };
        if (!cell || !(pattern.test(cell.text) || sameTariff())) continue;
      }

      const values: RowRecord["values"] = {};
      for (const source of table.sources) {
        if (overrides.has(source.field)) {
          values[source.field] = overrides.get(source.field) ?? null;
        } else if (source.column) {
          values[source.field] = read(source.column);
        } else if (source.cell) {
          // Un título que vale para toda la hoja («PRODUCTO TU DECIDES») no se
          // repite en cada copia: si la celda desplazada está vacía, se usa la
          // de la tabla original. Las cifras no: una cifra vacía es vacía.
          const shifted = cellAt(grid, shiftCellRef(source.cell, copy.columnShift, copy.rowShift, rowShift));
          values[source.field] =
            shifted ??
            (NUMERIC_FIELDS.has(source.field) ? null : cellAt(grid, shiftCellRef(source.cell, 0, 0, rowShift)));
        } else {
          values[source.field] = source.value;
        }
      }
      for (const [field, value] of overrides) {
        if (!(field in values)) values[field] = value;
      }

      // Una fila de precios sin energía no es una tarifa (ADX deja filas
      // con la potencia y «-» en la energía); una de potencia, sin potencia, tampoco.
      // Una indexada no trae la energía (es la del mercado): basta su potencia.
      const declared = values.pricing;
      const indexedTable = /index/i.test(typeof declared === "string" ? declared : (declared?.text ?? ""));
      const priceFields: RecipeField[] =
        table.kind === "prices"
          ? ["energyP1", "energyP2", "energyP3", ...(indexedTable ? (["powerP1", "powerP2"] as const) : [])]
          : table.kind === "power"
            ? ["powerP1", "powerP2"]
            : ["commissionAmount"];
      const priceCells = priceFields
        .map((field) => values[field])
        .filter((value): value is SheetCell | string => value !== null && value !== undefined)
        .map((value) => (typeof value === "string" ? { value, text: value } : value));
      // Un precio 0 tampoco es un precio: Naturgy deja «Digital Luz 2.0» a cero.
      const rowHasPrice = priceCells.some((cell) => {
        const parsed = parseNumber(cell);
        return !parsed.ok || (parsed.value !== null && parsed.value !== 0);
      });
      if (!rowHasPrice) continue;
      // Una subcabecera dentro del bloque («P1», «Tarifa») no es una fila de
      // datos; una celda rota (#REF!) sí, y se avisa al tiparla.
      const isHeader = priceCells.every((cell) => {
        const parsed = parseNumber(cell);
        return !parsed.ok && /[a-záéíóúñ]/i.test(cell.text) && !cell.text.trim().startsWith("#");
      });
      if (isHeader) continue;
      records.push({
        kind: table.kind,
        // El nombre real de la hoja («Precios YALUZ con FEE », con su espacio).
        sheet: grid.name,
        table: tableName(table),
        row,
        headerTerritory,
        headerIndexed,
        values,
        excerpt: rowExcerpt(grid, row),
      });
    }
  }

  if (records.length === 0) {
    // Una tabla de comisiones vacía suele ser una que la IA ha supuesto y el
    // libro no trae: se avisa, pero no tumba unos precios bien leídos.
    if (table.kind === "commissions") notes.push(`${label}: no se ha leído ninguna comisión.`);
    else fail("no se ha leído ninguna fila.");
  }
  return records;
}

const asCell = (value: SheetCell | string | null | undefined): SheetCell | null =>
  value === null || value === undefined ? null : typeof value === "string" ? { value, text: value } : value;

/** Texto de una celda; «N/A», «-» y parecidos cuentan como vacío. */
const text = (value: SheetCell | string | null | undefined) => {
  const raw = asCell(value)?.text.trim() || null;
  return raw && !/^(n\/?a|-+|–|—|null|ninguno|no aplica)$/i.test(raw) ? raw : null;
};

interface TypedRow {
  kind: RecipeTable["kind"];
  sheet: string;
  table: string;
  row: number;
  /** Territorios a los que se aplica una fila de potencia (vacío: todos). */
  territories: Set<string>;
  productName: string | null;
  level: string | null;
  accessTariff: string;
  tariffSinglePrice: boolean;
  territory: ExtractedRate["territory"];
  channel: ExtractedRate["channel"];
  segment: string | null;
  minKw: number | null;
  maxKw: number | null;
  minKwh: number | null;
  maxKwh: number | null;
  startFrom: string | null;
  startTo: string | null;
  months: number | null;
  numbers: Partial<Record<RecipeField, number | null>>;
  excerpt: string;
  raw: RowRecord["values"];
  headerIndexed: boolean;
}

/** Columnas «desde/hasta» de un tramo, que pueden traer «>100000». */
const BAND_PAIRS = [
  { min: "minKwh", max: "maxKwh", kind: "kwh" },
  { min: "minKw", max: "maxKw", kind: "kw" },
] as const satisfies readonly { min: RecipeField; max: RecipeField; kind: "kw" | "kwh" }[];

/** Cifras que hacen de una fila una tarifa: sin ellas la fila es una etiqueta. */
const PRICE_FIELDS = new Set<RecipeField>(["energyP1", "energyP2", "energyP3", "powerP1", "powerP2", "commissionAmount"]);

/**
 * Tipa una fila leída. Devuelve "label" si una celda de precio trae texto
 * («P1», «Consultar»): es una subcabecera o una fila sin precio, no una tarifa.
 * Una celda rota (#REF!) sí es un problema; un texto en otra cifra (un fee
 * «FEE MÍNIMO: 1€») se queda vacío.
 */
function typeRow(record: RowRecord, problems: RecipeProblem[]): TypedRow | "label" | null {
  const { values } = record;
  const numbers: TypedRow["numbers"] = {};
  // «>100000» en la columna «desde» (Eleia, el último tramo): es un tramo
  // abierto, no un número que falte. Se completa al final.
  const bandHints: { min: RecipeField; max: RecipeField; band: { min: number | null; max: number | null } }[] = [];
  for (const field of NUMERIC_FIELDS) {
    if (!(field in values)) continue;
    const parsed = parseNumber(asCell(values[field]));
    const pair = BAND_PAIRS.find(({ min, max }) => field === min || field === max);
    const cellText = text(values[field]);
    if (!parsed.ok && pair && cellText && /[<>≤≥]|m[aá]s de|menos de/i.test(cellText)) {
      const band = parseBand(cellText, pair.kind);
      if (band) {
        bandHints.push({ min: pair.min, max: pair.max, band });
        numbers[field] = null;
        continue;
      }
    }
    if (!parsed.ok) {
      if (parsed.reason.startsWith("celda con error")) {
        problems.push({
          sheet: record.sheet,
          message: `${record.excerpt.split(":")[0]}: ${field} ${parsed.reason}.`,
        });
        return null;
      }
      if (PRICE_FIELDS.has(field)) return "label";
      numbers[field] = null;
      continue;
    }
    numbers[field] = parsed.value === null ? null : round6(parsed.value);
  }
  for (const { min, max, band } of bandHints) {
    if (band.min !== null && (numbers[min] ?? null) === null) numbers[min] = round6(band.min);
    if (band.max !== null && (numbers[max] ?? null) === null) numbers[max] = round6(band.max);
  }

  const tariffText = text(values.accessTariff);
  const tariff = tariffText ? parseTariff(tariffText) : null;
  if (tariffText && !tariff) return null;
  // 2.0TD o gas de RL.1 a RL.4; lo demás (3.0TD, RL.5, planta satélite) no se lee.
  if (tariff && tariff.tariff !== "2.0TD" && !normalizeGasTariff(tariff.tariff)) return null;

  const powerBand = text(values.powerBand) ? parseBand(text(values.powerBand)!, "kw") : null;
  // Tramos de consumo en MWh (Axpo: «MWh/año» de 1 a 2,5): a kWh.
  const perMwh = /mwh/i.test(text(values.consumptionUnit) ?? "");
  const inKwh = (value: number | null | undefined) =>
    value === null || value === undefined ? null : perMwh ? Math.round(value * 1000) : value;
  const consumptionBand = text(values.consumptionBand)
    ? parseBand(text(values.consumptionBand)!, "kwh")
    : null;
  const month = asCell(values.startMonth) ? parseMonth(asCell(values.startMonth)) : null;
  const territoryText = text(values.territory);
  const channelText = text(values.channel);
  const termCell = asCell(values.termMonths);
  const contractEnd = asCell(values.contractEnd) ? parseDates(asCell(values.contractEnd))[0] : null;
  const startDate = asCell(values.startMonth) ? parseDates(asCell(values.startMonth))[0] : null;
  // De «1/9/26 a 31/8/27» salen 12 meses.
  const termFromDates =
    contractEnd && (startDate ?? month?.from)
      ? Math.round(
          (Date.parse(`${contractEnd}T00:00:00Z`) + 86_400_000 - Date.parse(`${startDate ?? month!.from}T00:00:00Z`)) /
            (86_400_000 * 30.4375),
        )
      : null;

  const territories = new Set<string>();
  for (const part of (territoryText ?? "").split(/\s+y\s+|,|\//)) {
    const parsed = parseTerritory(part);
    if (parsed) territories.add(parsed);
  }
  // Un territorio que no se entiende no se da por península: las islas
  // tienen otros precios.
  if (territoryText && territories.size === 0) {
    problems.push({
      sheet: record.sheet,
      message: `${record.excerpt.split(":")[0]}: no se reconoce el territorio «${territoryText}».`,
    });
    return null;
  }
  const productName = [text(values.productName), text(values.variant)].filter(Boolean).join(" ") || null;
  // Sin territorio en la plantilla vale el de la cabecera del bloque; si la
  // plantilla dice otro, se ha equivocado de bloque (YaLuz: «Canarias» en un
  // bloque titulado «Peninsula»).
  const declaredTerritory = territoryText ? parseTerritory(territoryText) : null;
  if (
    record.kind === "prices" &&
    declaredTerritory &&
    record.headerTerritory &&
    territories.size === 1 &&
    declaredTerritory !== record.headerTerritory
  ) {
    problems.push({
      sheet: record.sheet,
      message: `${record.excerpt.split(":")[0]}: la cabecera del bloque dice ${record.headerTerritory} y la plantilla ${declaredTerritory}.`,
    });
    return null;
  }

  return {
    kind: record.kind,
    sheet: record.sheet,
    table: record.table,
    row: record.row,
    territories,
    productName,
    level: text(values.level),
    accessTariff: tariff?.tariff ?? "2.0TD",
    tariffSinglePrice: tariff?.singlePrice ?? false,
    territory: declaredTerritory ?? record.headerTerritory ?? "peninsula",
    channel: channelText ? parseChannel(channelText) : null,
    segment: text(values.segment),
    minKw: numbers.minKw ?? powerBand?.min ?? null,
    maxKw: numbers.maxKw ?? powerBand?.max ?? null,
    minKwh: inKwh(numbers.minKwh) ?? consumptionBand?.min ?? null,
    maxKwh: inKwh(numbers.maxKwh) ?? consumptionBand?.max ?? null,
    startFrom: month?.from ?? null,
    startTo: month?.to ?? null,
    months: termCell
      ? typeof termCell.value === "number"
        ? termCell.value
        : parseTerm(termCell.text)
      : termFromDates,
    numbers,
    excerpt: record.excerpt,
    raw: values,
    headerIndexed: record.headerIndexed,
  };
}

/** Unidad de la energía: la que diga la plantilla o, si no, por la magnitud. */
function energyUnit(row: TypedRow): ExtractedRate["energyUnit"] {
  const sample = row.numbers.energyP1 ?? 0;
  const inferred: ExtractedRate["energyUnit"] = sample > 60 ? "eur_mwh" : sample > 1 ? "cent_kwh" : "eur_kwh";
  const declared = text(row.raw.energyUnit);
  const parsed = declared ? parseEnergyUnit(declared) : null;
  if (!parsed) return inferred;
  // Una energía de 24 €/kWh no existe: si la unidad declarada da una cifra
  // imposible, manda la magnitud (EDP da c€/kWh y la plantilla decía €/kWh).
  const perKwh = sample / { eur_kwh: 1, cent_kwh: 100, eur_mwh: 1000 }[parsed];
  return sample > 0 && (perKwh < 0.01 || perKwh > 1) ? inferred : parsed;
}

/** Unidad de la potencia: la que diga la plantilla o, si no, por la magnitud. */
function powerUnit(row: TypedRow): ExtractedRate["powerUnit"] {
  const declared = text(row.raw.powerUnit);
  const parsed = declared ? parsePowerUnit(declared) : null;
  if (parsed) return parsed;
  const sample = row.numbers.powerP1 ?? 0;
  // Gas: término fijo por cliente. Al día va de 0,1 a 3,5 €; al mes, de 2 a
  // 60; al año, de 25 en adelante. Mejor que la plantilla lo diga.
  if (normalizeGasTariff(row.accessTariff)) return sample > 60 ? "eur_year" : sample > 4 ? "eur_month" : "eur_day";
  return sample > 6 ? "eur_kw_year" : sample > 0.5 ? "eur_kw_month" : "eur_kw_day";
}

/** Los nombres casan si son iguales o uno contiene al otro («SUPER (N1)» y «N1»). */
function namesMatch(left: string | null, right: string | null): boolean | null {
  const a = key(left);
  const b = key(right);
  if (!a) return null;
  if (!b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Una fila de potencia vale para una de precios si todo lo que dice coincide:
 * producto, nivel, territorio y bandas. Nunca se relaja el nivel: unir la
 * potencia de N2 a una tarifa N1 sería un error silencioso. Una banda que solo
 * trae la potencia («Consumos 0-50.000 kWh/año») no impide casar: la fila de
 * precios la hereda, y si dos potencias distintas casan igual de bien, no se
 * une ninguna (ver applyRecipe).
 */
function powerMatches(power: TypedRow, price: TypedRow): number {
  let score = power.sheet === price.sheet ? 1 : 0;
  for (const [left, right] of [
    [power.productName, price.productName],
    [power.level, price.level],
  ] as const) {
    const matched = namesMatch(left, right);
    if (matched === false) return -1;
    if (matched) score++;
  }
  if (power.territories.size > 0) {
    if (!power.territories.has(price.territory ?? "peninsula")) return -1;
    score++;
  }
  for (const [left, right] of [
    [power.minKw, price.minKw],
    [power.maxKw, price.maxKw],
    [power.minKwh, price.minKwh],
    [power.maxKwh, price.maxKwh],
  ] as const) {
    if (left === null || right === null) continue;
    if (left !== right) return -1;
    score++;
  }
  return score;
}

/** Las bandas de la potencia que la fila de precios no trae. */
function inheritBands(row: TypedRow, power: TypedRow): TypedRow {
  return {
    ...row,
    minKw: row.minKw ?? power.minKw,
    maxKw: row.maxKw ?? power.maxKw,
    minKwh: row.minKwh ?? power.minKwh,
    maxKwh: row.maxKwh ?? power.maxKwh,
  };
}

function bool(value: SheetCell | string | null | undefined, fallback: boolean): boolean {
  const raw = text(value);
  return raw === null ? fallback : (parseBoolean(raw) ?? fallback);
}

/**
 * Aplica una plantilla a las hojas de un Excel y devuelve las mismas filas
 * que daría la extracción con IA, listas para validar y comparar.
 */
export function applyRecipe(grids: readonly SheetGrid[], recipe: StoredRecipe): AppliedRecipe {
  const problems: RecipeProblem[] = [];
  const notes: string[] = [];
  const typed: TypedRow[] = [];

  for (const table of recipe.tables) {
    const grid = findGrid(grids, table.sheet);
    if (!grid) {
      problems.push({ sheet: table.sheet, message: `No está la hoja «${table.sheet}».` });
      continue;
    }
    // La potencia y la energía no salen de la misma columna: Eleia leía las
    // dos de F. (Que coincidan las cifras sí puede pasar: INER cobra 0,1197 en
    // las dos.)
    const sourceOf = (field: RecipeField) => {
      const source = table.sources.find((candidate) => candidate.field === field);
      return source?.column?.replace(/\$/g, "") ?? source?.cell?.replace(/\$/g, "") ?? null;
    };
    if (
      sourceOf("powerP1") &&
      (sourceOf("powerP1") === sourceOf("energyP1") || (sourceOf("powerP2") !== null && sourceOf("powerP2") === sourceOf("energyP2")))
    ) {
      problems.push({
        sheet: table.sheet,
        message: `Hoja «${table.sheet}», ${tableName(table)}: la potencia sale de las mismas celdas que la energía; búscala en su bloque («TÉRMINO DE POTENCIA», «€/kW»).`,
      });
    }
    const records = readTable(grid, table, problems, notes);
    let labels = 0;
    for (const record of records) {
      const row = typeRow(record, problems);
      if (row === "label") labels++;
      else if (row) typed.push(row);
    }
    if (records.length > 0 && labels === records.length) {
      problems.push({
        sheet: table.sheet,
        message: `Hoja «${table.sheet}», ${tableName(table)}: ninguna fila tiene cifras en las columnas de precio (¿cabeceras en vez de datos?).`,
      });
    }
  }

  const powerRows = typed.filter(({ kind }) => kind === "power");
  const unjoined = new Map<string, { sheet: string; table: string; count: number }>();
  const ambiguous = new Map<string, { sheet: string; table: string; count: number }>();
  const tally = (map: typeof unjoined, row: TypedRow) => {
    const where = `${row.sheet}\u0000${row.table}`;
    const entry = map.get(where) ?? { sheet: row.sheet, table: row.table, count: 0 };
    entry.count++;
    map.set(where, entry);
  };
  const rates: ExtractedRate[] = [];
  const excerpts: string[] = [];
  const sheets: string[] = [];
  const origins: number[] = [];
  for (const priceRow of typed.filter(({ kind }) => kind === "prices")) {
    let row = priceRow;
    let power = { p1: row.numbers.powerP1 ?? null, p2: row.numbers.powerP2 ?? null, unit: powerUnit(row) };
    let joined = false;
    let tied = false;
    if (power.p1 === null && power.p2 === null) {
      const [best, second] = powerRows
        .map((candidate) => ({ candidate, score: powerMatches(candidate, row) }))
        .filter(({ score }) => score >= 0)
        .sort((left, right) => right.score - left.score);
      tied =
        !!second &&
        second.score === best.score &&
        (second.candidate.numbers.powerP1 !== best.candidate.numbers.powerP1 ||
          second.candidate.numbers.powerP2 !== best.candidate.numbers.powerP2);
      if (tied) {
        tally(ambiguous, row);
      } else if (best) {
        const match = best.candidate;
        power = { p1: match.numbers.powerP1 ?? null, p2: match.numbers.powerP2 ?? null, unit: powerUnit(match) };
        row = inheritBands(row, match);
        joined = true;
      }
    }

    // Mandan las cifras: si el libro trae la potencia, es esa aunque la
    // plantilla diga «BOE» (Axpo cobra BOE + 12 €/kW·año y lo escribe).
    const declaredMode = text(row.raw.powerMode)?.toLowerCase() ?? "";
    // Gas: un solo término fijo, sin P2.
    const gasRow = normalizeGasTariff(row.accessTariff) !== null;
    // Gas con «peajes + margen» o «peajes a coste»: lo que diga la plantilla,
    // con el término fijo del libro como margen.
    const gasMode = gasRow && /plus|margen/.test(declaredMode) ? "regulated_plus" : gasRow && /regul|boe/.test(declaredMode) ? "regulated" : null;
    const powerMode: ExtractedRate["powerMode"] = gasMode
      ? gasMode
      : power.p1 !== null && (power.p2 !== null || gasRow)
        ? "fixed"
        : /plus|margen/.test(declaredMode)
          ? "regulated_plus"
          : /regul|boe/.test(declaredMode)
            ? "regulated"
            : "not_stated";
    // Si la hoja trae bloques de potencia y la fila no casa con ninguno, la
    // plantilla no encaja, aunque declare «BOE»: en las islas de Axpo eso
    // dejaba la potencia regulada en vez de la del libro.
    const ownPower = row.numbers.powerP1 != null || row.numbers.powerP2 != null;
    const sheetHasPower = powerRows.some(({ sheet }) => sheet === row.sheet);
    if (!ownPower && !joined && !tied && (sheetHasPower || (powerMode === "not_stated" && powerRows.length > 0))) {
      tally(unjoined, row);
    }
    const energy = {
      p1: row.numbers.energyP1 ?? null,
      p2: row.numbers.energyP2 ?? null,
      p3: row.numbers.energyP3 ?? null,
    };
    const single =
      bool(row.raw.singlePrice, false) ||
      row.tariffSinglePrice ||
      (energy.p1 !== null && energy.p2 === null && energy.p3 === null);
    // 2.0TD tiene tres periodos de energía: dos precios son tramos horarios
    // («8 horas», «Solar»), que el comparador no sabe calcular. Y un producto
    // OMIE o indexado no es de precio fijo aunque esté en la misma tabla.
    const declaredPricing = text(row.raw.pricing)?.toLowerCase() ?? "fixed";
    const twoBands = !single && energy.p1 !== null && energy.p2 !== null && energy.p3 === null;
    const indexedName = looksIndexed(row.productName ?? "") || row.headerIndexed;
    const pricing = (
      declaredPricing === "fixed" && indexedName
        ? "indexed"
        : declaredPricing === "fixed" && twoBands
          ? "other"
          : declaredPricing
    ) as ExtractedRate["pricing"];
    const discount = text(row.raw.discountText);

    rates.push({
      productName: row.productName ?? row.sheet,
      accessTariff: row.accessTariff,
      pricing: ["fixed", "indexed", "flat", "other"].includes(pricing) ? pricing : "fixed",
      level: row.level,
      territory: row.territory,
      channel: row.channel,
      segment: row.segment,
      minKw: row.minKw,
      maxKw: row.maxKw,
      minKwh: row.minKwh,
      maxKwh: row.maxKwh,
      startFrom: row.startFrom,
      startTo: row.startTo,
      months: row.months,
      powerMode,
      powerUnit: powerMode === "fixed" || gasMode === "regulated_plus" ? power.unit : null,
      powerP1: powerMode === "fixed" || gasMode === "regulated_plus" ? power.p1 : null,
      powerP2: powerMode === "fixed" ? power.p2 : null,
      powerMargin: row.numbers.powerMargin ?? null,
      energyUnit: energyUnit(row),
      energyP1: energy.p1,
      energyP2: single ? null : energy.p2,
      energyP3: single ? null : energy.p3,
      singlePrice: single,
      ancillaryIncluded: bool(row.raw.ancillaryIncluded, true),
      gasTollsIncluded: gasRow ? bool(row.raw.tollsIncluded, true) : null,
      feeMinMwh: row.numbers.feeMinMwh ?? null,
      feeMaxMwh: row.numbers.feeMaxMwh ?? row.numbers.feeMinMwh ?? null,
      feeOnPower: bool(row.raw.feeOnPower, false),
      discounts: discount
        ? [
            {
              kind: /pot|tp/i.test(discount) && !/te\b|energ/i.test(discount) ? "power_percent" : "other",
              value: null,
              months: null,
              conditional: /pys|servicio|si |condici|mi iberdrola/i.test(discount),
              text: discount.slice(0, 80),
            },
          ]
        : [],
    });
    excerpts.push(row.excerpt);
    sheets.push(row.sheet);
    origins.push(row.row);
  }

  // EDP y YaLuz dan en la misma fila el precio por periodos y el único: son
  // dos ofertas, y sin distinguirlas en el nombre serían la misma tarifa.
  const variants = new Map<string, Set<boolean>>();
  const variantKey = (rate: ExtractedRate) =>
    JSON.stringify([
      key(rate.productName), rate.level?.toLowerCase() ?? null, rate.territory, rate.channel,
      rate.segment, rate.minKw, rate.maxKw, rate.minKwh, rate.maxKwh, rate.startFrom,
      rate.startTo, rate.months, rate.ancillaryIncluded, rate.feeMinMwh, rate.pricing,
    ]);
  for (const rate of rates) {
    const kinds = variants.get(variantKey(rate)) ?? new Set<boolean>();
    kinds.add(rate.singlePrice);
    variants.set(variantKey(rate), kinds);
  }
  for (const rate of rates) {
    if (rate.singlePrice && variants.get(variantKey(rate))!.size > 1) {
      rate.productName = `${rate.productName} (precio único)`;
    }
  }

  // Un libro que repite un bloque entero (YaLuz da los precios base en dos
  // hojas) no tiene dos tarifas: si dos filas son idénticas en todo, nombre,
  // condiciones y precios, se queda una. Si cambia un precio, sí es un
  // duplicado y lo detecta la validación.
  const repeated: { sheet: string; row: number }[] = [];
  const identical = new Set<string>();
  for (let index = 0; index < rates.length; index++) {
    const fingerprint = JSON.stringify({ ...rates[index], productName: key(rates[index].productName) });
    if (!identical.has(fingerprint)) {
      identical.add(fingerprint);
      continue;
    }
    repeated.push({ sheet: sheets[index], row: origins[index] });
    rates.splice(index, 1);
    excerpts.splice(index, 1);
    sheets.splice(index, 1);
    origins.splice(index, 1);
    index--;
  }

  for (const { sheet, table, count } of unjoined.values()) {
    problems.push({
      sheet,
      message: `Hoja «${sheet}», ${table}: ${count} filas sin potencia y ninguna fila de potencia casa con ellas (producto, nivel, territorio o banda).`,
    });
  }
  for (const { sheet, table, count } of ambiguous.values()) {
    problems.push({
      sheet,
      message: `Hoja «${sheet}», ${table}: ${count} filas casan igual de bien con dos potencias distintas; distingue las tablas de potencia (producto, nivel, territorio o banda) o apunta la potencia con cell.`,
    });
  }

  const commissions: ExtractedCommission[] = typed
    .filter(({ kind }) => kind === "commissions")
    .map((row) => {
      const type = text(row.raw.commissionType)?.toLowerCase() ?? "fixed";
      return {
        productName: row.productName,
        // El peaje de la fila: las comisiones de gas van por RL (Axpo «MR GAS»).
        accessTariff: row.accessTariff,
        energy: energyOfTariff(row.accessTariff),
        pricing: "fixed" as const,
        level: row.level,
        channel: row.channel ?? "both",
        minKwh: row.minKwh,
        maxKwh: row.maxKwh,
        minKw: row.minKw,
        maxKw: row.maxKw,
        ruleType: (["fixed", "per_mwh", "fee_share"].includes(type) ? type : "fixed") as ExtractedCommission["ruleType"],
        feeBase: (text(row.raw.feeBase)?.toLowerCase() === "power" ? "power" : "energy") as "energy" | "power",
        amount: row.numbers.commissionAmount ?? 0,
        minAmount: null,
      };
    });

  const dateCell = (ref: SheetRecipe["validFrom"]) => {
    if (!ref) return [];
    const grid = findGrid(grids, ref.sheet);
    return grid ? parseDates(cellAt(grid, shiftCellRef(ref.cell, 0, 0))) : [];
  };
  const fromDates = dateCell(recipe.validFrom);
  const toDates = dateCell(recipe.validTo);
  const sameCell =
    recipe.validTo && recipe.validFrom && recipe.validTo.cell === recipe.validFrom.cell;

  const covered = new Set(recipe.tables.map(({ sheet }) => key(sheet)));
  const skipped = [
    ...recipe.skippedSheets.map(({ sheet, reason }) => `${sheet} (${reason})`),
    ...(recipe.skippedRanges ?? []).map(({ sheet, range, reason }) => `${sheet} ${range} (${reason})`),
    ...grids
      .filter((grid) => !covered.has(key(grid.name)) && !recipe.skippedSheets.some(({ sheet }) => key(sheet) === key(grid.name)))
      .map((grid) => `${grid.name} (sin tabla en la plantilla)`),
  ];

  return {
    extraction: {
      supplierName: recipe.supplierName,
      documentKind:
        rates.length && commissions.length
          ? "prices_and_commissions"
          : commissions.length
            ? "commissions"
            : "prices",
      validFrom: fromDates[0] ?? null,
      validTo: sameCell ? (fromDates[1] ?? null) : (toDates[0] ?? null),
      partialUpdate: false,
      rates,
      commissions,
      skipped,
    },
    excerpts,
    sheets,
    rows: origins,
    repeated,
    problems,
    notes,
  };
}
