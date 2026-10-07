import { NoObjectGeneratedError } from "ai";
import { generateStructured } from "@/comparador/ai/gateway";
import type { AiJobContext } from "@/comparador/ai/usage";
import type { RateExtractionAttempt, RateExtractionResult } from "../extract";
import { normalizeName } from "../names";
import { toProposedCommissions, toProposedRates } from "../normalize";
import {
  hasBlockingIssues,
  isInScope,
  rowKey,
  validateProposedRates,
  type RateIssue,
} from "../validate";
import { applyRecipe, locateAnchor, type AppliedRecipe, type StoredRecipe } from "./apply";
import { columnIndex, columnLetter, findSheet, renderGrid, workbookSignature, type SheetGrid } from "./grid";
import { parseNumber, parseTariff } from "./parse";
import { SheetRecipeSchema, type SheetRecipe } from "./recipe";
import type { RecipeStore } from "./store";

/** Hojas que no se enseñan a la IA por su nombre: indexadas, gas, simuladores. */
const SKIPPED_SHEET =
  /index|omie|\bpool\b|din[aá]mica|pass.?through|\bgas\b|\bRL\.?\s?\d|simulador|calculadora|hist[oó]rico/i;

/** Texto por hoja que se enseña a la IA: la forma, no hace falta cada fila. */
const MAX_SHEET_CHARS = 25_000;
const MAX_WORKBOOK_CHARS = 80_000;

export const RECIPE_INSTRUCTIONS = `Escribes plantillas para leer Excel de precios de comercializadoras españolas de electricidad. No copias precios: dices en qué hoja, filas y columnas está cada dato, y nuestro código lee las celdas.
Cada hoja viene con sus filas numeradas como en Excel («12|») y cada celda con su columna («C=0.169233»).
Solo interesan las tarifas 2.0TD de precio fijo (también «20TD» o «2.01P», que es 2.0TD de precio único) y las comisiones de la agencia. No hagas tablas de 3.0TD, 6.1TD, gas, productos indexados, simuladores ni calculadoras: menciónalas en skippedSheets si ocupan una hoja entera, o en skippedRanges («AO18:BB72») si son un bloque junto a los fijos.
Una comisión es lo que la comercializadora paga a la agencia por cada contrato (remuneración, comisión, «pago al canal»). No son comisiones: el precio de servicios que se venden con la luz (PyS, mantenimiento, urgencias, packs), el fee o margen de un producto indexado, ni los descuentos al cliente. Si dudas, no hagas tabla de comisiones.
Una tabla es un bloque de filas de datos. kind prices para filas con precios de energía (y potencia si está en la misma fila); kind power para bloques que solo traen potencia y se unen a los de precios por productName, level, territory y bandas, así que ponles los mismos valores (el nivel de un bloque de potencia es el de su columna, no el territorio del título); kind commissions para comisiones.
Si la potencia de cada bloque de precios está en una celda fija (un apartado «POTENCIAS» con una fila por tarifa), es más sencillo leerla desde la tabla de precios con cell. Con repeat la celda se mueve con cada copia; como en Excel, «C$40» se mueve de columna pero no de fila (la misma potencia para Baleares y Canarias) y «$C$40» no se mueve nunca. Igual con las columnas: «$Q» lee siempre la columna Q aunque la copia esté más a la derecha.
firstRow y lastRow son las filas de datos (sin la cabecera). startText es un texto fijo del título o cabecera que hay justo encima de los datos (por ejemplo «SUPER (N1)» o «2.0TD _ 2 P1 <= 10kW»), para encontrarlos si se mueven filas. expect son dos o tres celdas de título o cabecera con su texto exacto (nunca precios ni fechas).
Si en las filas se mezclan tarifas, usa rowFilter sobre la columna de la tarifa con un patrón como «^2[.,]?0».
Si una columna solo tiene valor en la primera fila de cada grupo (subsistema, tarifa), ponla en fillDown.
Si el mismo bloque se repite a la derecha para otros niveles (N1, N2, N3; Agencia, Estándar…) o hacia abajo para otro producto o territorio, haz una sola tabla con el primer bloque y añade en repeat cada copia con su columnShift y rowShift (columnas y filas de distancia) y los valores que cambian (level, productName, territory…). Así la plantilla es corta: un libro como el de Axpo cabe en pocas tablas.
sources: una entrada por dato. column si cambia en cada fila; cell si sale de una celda fija (el título del bloque con el nombre del producto o la banda de potencia); value si es una constante.
Campos: productName (nombre comercial sin nivel ni tarifa; si la hoja es un producto, su título), variant (lo que distingue dos bloques del mismo producto sin campo propio: «con GdO», «verde»; se añade al nombre), level, accessTariff, territory (peninsula, baleares, canarias, ceuta_melilla o el texto de la celda), channel (captación o renovación), segment, powerBand (texto con la banda de potencia, p. ej. «P1 <= 10kW»), consumptionBand (texto con la banda de consumo), minKw/maxKw/minKwh/maxKwh (números), startMonth (texto como «Inicio Enero27» o fecha, si el precio depende del inicio del suministro), contractEnd (fecha hasta la que dura el precio fijo, si hay una columna con ella; la duración la calcula el código), termMonths (duración), energyP1/energyP2/energyP3 (punta, llano, valle; si hay un único precio, solo energyP1 y singlePrice true), powerP1/powerP2 (punta y valle), powerMargin, feeMinMwh/feeMaxMwh (fee que suma el comercial), discountText.
Constantes con value: energyUnit (eur_kwh, cent_kwh o eur_mwh), powerUnit (eur_kw_day, eur_kw_month o eur_kw_year), singlePrice (true o false), powerMode (fixed, regulated si es la potencia BOE, regulated_plus), pricing (fixed salvo que el bloque sea indexado o por franjas: other), ancillaryIncluded (si el precio incluye los servicios de ajuste, SSAA; no es para GdO ni energía verde), feeOnPower, commissionType (fixed, per_mwh o fee_share), feeBase (energy o power), commissionAmount (columna con el importe).
Mira la cabecera para las unidades: «€/kW año» es eur_kw_year, «€/kW día» eur_kw_day, «€/MWh» eur_mwh, «c€/kWh» cent_kwh.
validFrom y validTo: la celda con la fecha (o el texto con las dos fechas) de vigencia, si existe.`;

/** Ningún modelo ha escrito una plantilla legible: la ingesta falla con este mensaje. */
export class SheetRecipeUnavailableError extends Error {
  constructor() {
    super(
      "No se ha podido preparar la lectura de este Excel. Prueba a subir solo las hojas de 2.0TD o el PDF del anexo.",
    );
    this.name = "SheetRecipeUnavailableError";
  }
}

export interface SheetReadResult {
  result: RateExtractionResult;
  recipe: {
    /** cache: plantilla guardada; repaired: guardada con hojas rehechas; generated: nueva. */
    source: "cache" | "repaired" | "generated" | "none";
    tables: number;
    problems: string[];
    /** La plantilla usada (para diagnosticar una lectura; no se guarda con la ingesta). */
    definition: StoredRecipe;
  };
}

interface Assessment {
  applied: AppliedRecipe;
  issues: RateIssue[];
  healthy: boolean;
  /** Hojas donde está lo que falla: las que se rehacen al reparar. */
  failingSheets: string[];
  /** Lo que falla en total, para quedarse con la mejor plantilla. */
  faults: number;
  /** Lo que falla, con la hoja y la fila, para explicárselo a la IA. */
  report: string[];
}

const TRUSTWORTHY_BLOCKERS = new Set([
  "energy_out_of_range",
  "power_out_of_range",
  "missing_energy",
  "duplicate_row",
]);

const sheetKey = (name: string) => normalizeName(name);

/**
 * Qué distingue a dos filas que la plantilla lee como la misma tarifa: las
 * columnas en que cambian. Es la pista para que la IA lea esa columna (un
 * plazo, un tarifario, un nivel) en vez de adivinarla.
 */
function rowDifference(
  grids: readonly SheetGrid[],
  origins: readonly { sheet: string; row: number }[],
): string {
  const located = origins.map(({ sheet, row }) => ({
    grid: grids.find(({ name }) => name === sheet),
    row,
  }));
  const textAt = (grid: SheetGrid | undefined, row: number, column: number) =>
    grid?.rows[row - 1]?.[column]?.text.trim() ?? "";
  /** Lo que hay en la columna o, si está vacía, lo último escrito encima (un subsistema, una tarifa). */
  const carried = (grid: SheetGrid | undefined, row: number, column: number) => {
    for (let above = row; above > Math.max(0, row - 80); above--) {
      const text = textAt(grid, above, column);
      if (text) return text;
    }
    return "";
  };
  const width = Math.max(0, ...located.map(({ grid, row }) => grid?.rows[row - 1]?.length ?? 0));
  const changed: string[] = [];
  const fromAbove: string[] = [];
  for (let column = 0; column < width; column++) {
    const own = located.map(({ grid, row }) => textAt(grid, row, column));
    if (new Set(own).size > 1) {
      changed.push(`${columnLetter(column)} (${own.map((text) => `«${text || "vacía"}»`).join(" / ")})`);
      continue;
    }
    const above = located.map(({ grid, row }) => carried(grid, row, column));
    const isLabel = above.every((text) => text && !/^-?[\d.,\s€%]+$/.test(text));
    if (isLabel && new Set(above).size > 1) {
      fromAbove.push(`${columnLetter(column)} (${above.map((text) => `«${text}»`).join(" / ")})`);
    }
  }
  const sameSheet = new Set(origins.map(({ sheet }) => sheet)).size === 1;
  if (fromAbove.length > 0) {
    return `las distingue lo que está escrito más arriba en ${fromAbove.slice(0, 3).join(", ")}: lee esa columna con fillDown.`;
  }
  if (changed.length === 0) {
    return "son la misma fila leída dos veces: hay tablas o copias que se solapan.";
  }
  return `${sameSheet ? "" : "están en hojas distintas; "}solo cambian ${changed.slice(0, 4).join(", ")}${changed.length > 4 ? "…" : ""}. Lee lo que las distingue (plazo, nivel, tarifario, banda…) o descarta la que no sea 2.0TD de precio fijo.`;
}

/** Cabecera de una columna de potencia o de fee, no de energía. */
const POWER_HEADER = /potencia|€\s*\/\s*kw(?!h)|kw\s*(día|dia|año|mes)|\bfee\b/i;

/**
 * Los textos de encima de una celda en su columna (hasta seis filas, sin
 * cifras), donde está su cabecera; si la columna no tiene, la del bloque a la
 * izquierda en la fila de títulos (las cabeceras combinadas quedan en la
 * primera columna del bloque).
 */
function headerAbove(grid: SheetGrid, row: number, column: number): string {
  const texts: string[] = [];
  for (let above = row - 1; above >= Math.max(1, row - 6); above--) {
    for (let left = column; left >= Math.max(0, column - 3); left--) {
      const cell = grid.rows[above - 1]?.[left];
      if (!cell || !cell.text.trim()) continue;
      if (parseNumber(cell).ok) break;
      texts.push(cell.text);
      break;
    }
  }
  return texts.join(" ");
}

/** Precio de energía en €/kWh plausible: lo que sigue a una etiqueta 2.0TD en una fila de precios. */
const ENERGY_LIKE = (value: number) => value >= 0.03 && value <= 0.6;

/**
 * Filas del libro con una etiqueta 2.0TD seguida de un precio de energía que
 * la plantilla no lee. Es la red contra lo que falta sin avisar: un nivel
 * nuevo, un bloque que la IA no vio o un filtro que deja fuera «2.01P».
 * Se cuenta por fila: una fila con dos bloques (periodos y precio único)
 * tiene que dar dos tarifas.
 */
function unreadRows(
  grids: readonly SheetGrid[],
  recipe: StoredRecipe,
  applied: AppliedRecipe,
): { sheet: string; rows: number[] }[] {
  // Una hoja descartada no se comprueba, salvo que la plantilla la lea: la IA
  // a veces pone en skippedSheets las mismas hojas para las que hace tablas.
  const withTables = new Set(recipe.tables.map(({ sheet }) => sheetKey(sheet)));
  const ignored = new Set(
    recipe.skippedSheets.map(({ sheet }) => sheetKey(sheet)).filter((sheet) => !withTables.has(sheet)),
  );
  // Bloques que la plantilla descarta a propósito (el indexado «AB» de Logos).
  const ranges = (recipe.skippedRanges ?? []).flatMap(({ sheet, range }) => {
    const match = /^\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)$/i.exec(range.trim());
    return match
      ? [{
          sheet: sheetKey(sheet),
          left: columnIndex(match[1]),
          top: Number(match[2]),
          right: columnIndex(match[3]),
          bottom: Number(match[4]),
        }]
      : [];
  });
  const skippedCell = (sheet: string, row: number, column: number) =>
    ranges.some(
      (range) =>
        range.sheet === sheetKey(sheet) &&
        row >= range.top &&
        row <= range.bottom &&
        column >= range.left &&
        column <= range.right,
    );
  const read = new Map<string, number>();
  const origins = [
    ...applied.sheets.map((sheet, index) => ({ sheet, row: applied.rows[index] })),
    ...applied.repeated,
  ];
  for (const { sheet, row } of origins) {
    const at = `${sheet}\u0000${row}`;
    read.set(at, (read.get(at) ?? 0) + 1);
  }
  const missing: { sheet: string; rows: number[] }[] = [];
  for (const grid of grids) {
    if (SKIPPED_SHEET.test(grid.name) || ignored.has(sheetKey(grid.name))) continue;
    const rows: number[] = [];
    grid.rows.forEach((cells, index) => {
      let blocks = 0;
      for (let column = 0; column < cells.length; column++) {
        const label = cells[column]?.text ?? "";
        if (parseTariff(label)?.tariff !== "2.0TD") continue;
        if (skippedCell(grid.name, index + 1, column)) continue;
        // Las cifras que siguen a la etiqueta, hasta el primer texto: una
        // cabecera («P1») o la etiqueta del bloque de al lado.
        let seen = 0;
        for (let next = column + 1; next < cells.length && seen < 8; next++) {
          const cell = cells[next];
          if (!cell) continue;
          const parsed = parseNumber(cell);
          if (!parsed.ok) break;
          if (parsed.value === null) continue;
          seen++;
          if (!ENERGY_LIKE(parsed.value)) continue;
          // Una potencia en €/kW día (Logos: 0,1088 / 0,0349) parece energía:
          // la cabecera de su columna lo aclara.
          if (POWER_HEADER.test(headerAbove(grid, index + 1, next))) continue;
          // La cifra siguiente también ha de ser energía (o no haber más): una
          // potencia en €/kW día da 0,0759 / 0,0020 y no es una tarifa.
          const following = cells
            .slice(next + 1)
            .map((cell) => (cell ? parseNumber(cell) : null))
            .find((parsed) => parsed && (!parsed.ok || parsed.value !== null));
          if (!following || !following.ok || ENERGY_LIKE(following.value!)) blocks++;
          break;
        }
      }
      const row = index + 1;
      if (blocks > (read.get(`${grid.name}\u0000${row}`) ?? 0)) rows.push(row);
    });
    if (rows.length) missing.push({ sheet: grid.name, rows });
  }
  return missing;
}

/** ¿La plantilla ha leído algo creíble de este libro? Y si no, ¿dónde falla? */
function assess(grids: readonly SheetGrid[], recipe: StoredRecipe): Assessment {
  const applied = applyRecipe(grids, recipe);
  for (const { sheet, rows } of unreadRows(grids, recipe, applied)) {
    applied.problems.push({
      sheet,
      message: `Hoja «${sheet}»: ${rows.length === 1 ? "la fila" : "las filas"} ${rows.slice(0, 8).join(", ")}${rows.length > 8 ? "…" : ""} ${rows.length === 1 ? "tiene" : "tienen"} precios de 2.0TD que la plantilla no lee (o lee menos bloques de los que hay).`,
    });
  }
  const proposed = toProposedRates(applied.extraction, null);
  const issues = validateProposedRates(proposed, {
    sourceText: null,
    partialUpdate: false,
    validFrom: applied.extraction.validFrom,
    readFromCells: true,
  });
  const empty =
    proposed.filter(isInScope).length === 0 &&
    toProposedCommissions(applied.extraction).length === 0;

  // Cada bloqueo apunta a su fila; un duplicado, a todas las filas iguales
  // (pueden estar en hojas distintas).
  const blockers = issues.filter(
    ({ severity, code }) => severity === "blocking" && TRUSTWORTHY_BLOCKERS.has(code),
  );
  const failing = new Set(
    applied.problems.flatMap(({ sheet }) => (sheet ? [sheet] : [])),
  );
  const report = applied.problems.map(({ message }) => message);
  const explained = new Set<string>();
  for (const issue of blockers) {
    const rows =
      issue.code === "duplicate_row" && issue.rowKey !== undefined
        ? proposed.flatMap((row, index) => (rowKey(row) === issue.rowKey ? [index] : []))
        : issue.row !== undefined
          ? [issue.row]
          : [];
    for (const row of rows) failing.add(applied.sheets[row]);
    const where = rows.map((row) => `«${applied.sheets[row]}» fila ${applied.rows[row]}`);
    if (issue.code === "duplicate_row") {
      // Un aviso por grupo de filas iguales, con lo que las distingue.
      if (explained.has(issue.rowKey ?? "")) continue;
      explained.add(issue.rowKey ?? "");
      const origins = rows.map((row) => ({ sheet: applied.sheets[row], row: applied.rows[row] }));
      report.push(`${issue.message} (${where.join("; ")}): ${rowDifference(grids, origins)}`);
      continue;
    }
    report.push(`${issue.message}${where.length ? ` (${where.join("; ")})` : ""}`);
  }

  return {
    applied,
    issues,
    healthy: applied.problems.length === 0 && !empty && blockers.length === 0,
    failingSheets: empty ? [] : [...failing],
    faults: applied.problems.length + blockers.length + (empty ? 1_000 : 0),
    report,
  };
}

/** Fila del texto ancla al crear la plantilla, para reencontrar los datos si se mueven. */
function withAnchors(grids: readonly SheetGrid[], recipe: SheetRecipe | StoredRecipe): StoredRecipe {
  return {
    ...recipe,
    tables: recipe.tables.map((table) => {
      // Las tablas que ya tenían ancla (las no reparadas) la conservan.
      if ("anchorRow" in table && table.anchorRow !== undefined) return table;
      const grid = grids.find(({ name }) => name === table.sheet);
      if (!grid || !table.startText) return { ...table, anchorRow: null };
      return { ...table, anchorRow: locateAnchor(grid, table.startText, table.firstRow - 1) };
    }),
  };
}

function renderWorkbook(grids: readonly SheetGrid[]): { text: string; skipped: string[] } {
  const skipped: string[] = [];
  const parts: string[] = [];
  let size = 0;
  for (const grid of grids) {
    if (SKIPPED_SHEET.test(grid.name)) {
      skipped.push(grid.name);
      continue;
    }
    const rendered = renderGrid(grid, MAX_SHEET_CHARS, { compactNumbers: true });
    if (size + rendered.length > MAX_WORKBOOK_CHARS) {
      skipped.push(`${grid.name} (no cabe)`);
      continue;
    }
    parts.push(rendered);
    size += rendered.length;
  }
  return { text: parts.join("\n\n"), skipped };
}

/**
 * Ajusta una plantilla guardada a las hojas de este libro. Una hoja numerada
 * con la edición («Precios y13.2026» → «Precios y14.2026») toma el nombre
 * nuevo; una que ya no existe se quita con sus tablas (MasMax Mini parte de
 * la plantilla de MasMax, cuya hoja «PreciofijoMASMAX» no está en su libro).
 */
function alignToWorkbook(grids: readonly SheetGrid[], recipe: StoredRecipe): StoredRecipe {
  const current = (sheet: string) => findSheet(grids, sheet)?.name;
  const dateCell = (ref: StoredRecipe["validFrom"]) =>
    ref && current(ref.sheet) ? { ...ref, sheet: current(ref.sheet)! } : null;
  return {
    ...recipe,
    validFrom: dateCell(recipe.validFrom),
    validTo: dateCell(recipe.validTo),
    tables: recipe.tables.flatMap((table) =>
      current(table.sheet) ? [{ ...table, sheet: current(table.sheet)! }] : [],
    ),
    skippedSheets: recipe.skippedSheets.flatMap((skipped) =>
      current(skipped.sheet) ? [{ ...skipped, sheet: current(skipped.sheet)! }] : [],
    ),
    skippedRanges: (recipe.skippedRanges ?? []).flatMap((skipped) =>
      current(skipped.sheet) ? [{ ...skipped, sheet: current(skipped.sheet)! }] : [],
    ),
  };
}

/** Hojas que se enseñan a la IA y que la plantilla no lee ni descarta. */
function uncoveredSheets(grids: readonly SheetGrid[], recipe: StoredRecipe): string[] {
  const known = new Set([
    ...recipe.tables.map(({ sheet }) => sheetKey(sheet)),
    ...recipe.skippedSheets.map(({ sheet }) => sheetKey(sheet)),
  ]);
  return grids
    .filter(({ name }) => !SKIPPED_SHEET.test(name) && !known.has(sheetKey(name)))
    .map(({ name }) => name);
}

/**
 * Hojas que hay que rehacer para que una plantilla encaje, o `null` si hay que
 * escribirla de cero (falla todo, o no se sabe dónde).
 */
function repairScope(
  grids: readonly SheetGrid[],
  recipe: StoredRecipe,
  assessment: Assessment,
  extra: readonly string[] = [],
): string[] | null {
  const present = new Map(grids.map(({ name }) => [sheetKey(name), name]));
  const scope = [
    ...new Set(
      [...assessment.failingSheets, ...extra]
        .map((sheet) => present.get(sheetKey(sheet)))
        .filter((sheet): sheet is string => Boolean(sheet)),
    ),
  ];
  const read = new Set(recipe.tables.map(({ sheet }) => sheetKey(sheet)));
  const untouched = [...read].filter((sheet) => !scope.some((name) => sheetKey(name) === sheet));
  if (scope.length === 0 || untouched.length === 0) return null;
  return scope;
}

const inSheets = (sheets: readonly string[], sheet: string) =>
  sheets.some((name) => sheetKey(name) === sheetKey(sheet));

/**
 * Sustituye las tablas de las hojas reparadas; el resto de la plantilla se
 * conserva, con sus anclas.
 */
function mergeRepair(base: StoredRecipe, patch: SheetRecipe, scope: readonly string[]): StoredRecipe {
  const inScope = (sheet: string) => inSheets(scope, sheet);
  return {
    ...base,
    validFrom: base.validFrom ?? patch.validFrom,
    validTo: base.validTo ?? patch.validTo,
    skippedSheets: [
      ...base.skippedSheets.filter(({ sheet }) => !inScope(sheet)),
      ...patch.skippedSheets.filter(({ sheet }) => inScope(sheet)),
    ],
    skippedRanges: [
      ...(base.skippedRanges ?? []).filter(({ sheet }) => !inScope(sheet)),
      ...(patch.skippedRanges ?? []).filter(({ sheet }) => inScope(sheet)),
    ],
    tables: [
      ...base.tables.filter(({ sheet }) => !inScope(sheet)),
      ...patch.tables.filter(({ sheet }) => inScope(sheet)),
    ],
  };
}

const failureText = (assessment: Assessment) => assessment.report.slice(0, 20).join("\n");

/** Una plantilla escrita a mano, con las anclas que pone el código al guardarla. */
export function prepareRecipe(grids: readonly SheetGrid[], recipe: SheetRecipe | StoredRecipe): StoredRecipe {
  return withAnchors(grids, recipe);
}

/** Lo que diría la lectura de una plantilla, sin llamar a la IA (para el banco de pruebas). */
export function checkRecipe(grids: readonly SheetGrid[], recipe: StoredRecipe) {
  const { healthy, report, applied } = assess(grids, recipe);
  return { healthy, report, applied };
}

/**
 * Lee un Excel de precios con una plantilla: la guardada para esa
 * comercializadora si encaja; si falla en algunas hojas, la IA rehace solo
 * esas (pagar por lo que ha cambiado, no por el libro entero); y si no hay
 * ninguna, la escribe de cero. Las cifras salen siempre de las celdas.
 */
export async function readSpreadsheet({
  grids,
  supplierName,
  context,
  store,
  models,
  generate = generateStructured,
}: {
  grids: readonly SheetGrid[];
  supplierName: string | null;
  context: AiJobContext;
  store: RecipeStore | null;
  models: readonly string[];
  generate?: typeof generateStructured;
}): Promise<SheetReadResult> {
  const signature = workbookSignature(grids);
  const supplierKey = supplierName ? normalizeName(supplierName) : null;
  const attempts: RateExtractionAttempt[] = [];
  let costUsd: number | null = null;
  let source: SheetReadResult["recipe"]["source"] = "none";
  let best: {
    recipe: StoredRecipe;
    assessment: Assessment;
    source: SheetReadResult["recipe"]["source"];
  } | null = null;
  let healthy = false;
  /** Plantilla de partida para reparar y hojas nuevas que hay que añadirle. */
  let base: { recipe: StoredRecipe; assessment: Assessment; newSheets: string[] } | null = null;
  let feedback: string | null = null;
  /** Aviso tras una respuesta cortada o ilegible, para el siguiente modelo. */
  let retryNote: string | null = null;

  const cached = supplierKey && store ? await store.find(supplierKey, signature) : null;
  if (cached) {
    cached.recipe = alignToWorkbook(grids, cached.recipe);
    const assessment = assess(grids, cached.recipe);
    // Un libro con otra forma (una hoja nueva) se lee con la última plantilla
    // de la comercializadora, pero las hojas que no conoce hay que añadirlas.
    const newSheets = cached.exact ? [] : uncoveredSheets(grids, cached.recipe);
    if (cached.exact) await store!.record(cached.id, assessment.healthy);
    best = { recipe: cached.recipe, assessment, source: "cache" };
    if (assessment.healthy && newSheets.length === 0) {
      healthy = true;
      if (!cached.exact) {
        await store!.save({ supplierKey: supplierKey!, signature, recipe: cached.recipe, model: "reused" });
      }
    } else {
      base = { recipe: cached.recipe, assessment, newSheets };
      feedback = `Había una plantilla guardada que ya no encaja con este libro. Problemas:\n${failureText(assessment)}`;
    }
  }

  const workbook = renderWorkbook(grids);
  if (!healthy) {
    for (const model of models) {
      const scope = base ? repairScope(grids, base.recipe, base.assessment, base.newSheets) : null;
      const content: { type: "text"; text: string }[] = [];
      if (scope && base) {
        const sheets = grids.filter(({ name }) => inSheets(scope, name));
        content.push(
          { type: "text", text: renderWorkbook(sheets).text },
          {
            type: "text",
            text:
              `La plantilla de este libro lee bien las demás hojas; solo hay que rehacer ${scope.map((sheet) => `«${sheet}»`).join(", ")}.\n` +
              `Tablas actuales de esas hojas:\n${JSON.stringify(base.recipe.tables.filter(({ sheet }) => inSheets(scope, sheet)))}\n` +
              (base.assessment.report.length ? `Problemas:\n${failureText(base.assessment)}\n` : "") +
              (base.newSheets.length ? `Hojas nuevas, sin tablas todavía: ${base.newSheets.join(", ")}.\n` : "") +
              "Devuelve solo las tablas de esas hojas (y en skippedSheets las que no tengan 2.0TD de precio fijo). Las demás se conservan.",
          },
          ...(retryNote ? [{ type: "text" as const, text: retryNote }] : []),
        );
      } else {
        content.push(
          { type: "text", text: workbook.text },
          ...(feedback ? [{ type: "text" as const, text: feedback }] : []),
          ...(retryNote ? [{ type: "text" as const, text: retryNote }] : []),
          {
            type: "text",
            text: "Escribe la plantilla para leer las tarifas 2.0TD de precio fijo y las comisiones de este libro.",
          },
        );
      }

      let result;
      try {
        result = await generate({
          context: { ...context, jobType: "rate_extraction" },
          model,
          schema: SheetRecipeSchema,
          instructions: RECIPE_INSTRUCTIONS + (supplierName ? `\n\nEl libro es de ${supplierName}.` : ""),
          messages: [{ role: "user", content }],
          // Una plantilla es entender cómo está montado el libro, no copiar:
          // un poco de razonamiento evita los errores de bloque y de nivel.
          reasoning: "low",
          maxOutputTokens: 32_000,
        });
      } catch (error) {
        // Una respuesta cortada o ilegible no tumba la lectura: el siguiente
        // modelo lo intenta sabiendo que tiene que ser más corta.
        if (!NoObjectGeneratedError.isInstance(error)) throw error;
        attempts.push({
          model,
          issues: [],
          costUsd: null,
          inputTokens: error.usage?.inputTokens ?? null,
          outputTokens: error.usage?.outputTokens ?? null,
        });
        retryNote =
          error.finishReason === "length"
            ? "Tu plantilla anterior era demasiado larga y se cortó. Usa repeat (columnShift y rowShift) para los bloques que se repiten y deja fuera lo que no sea 2.0TD de precio fijo."
            : "Tu respuesta anterior no se pudo leer. Devuelve solo la plantilla.";
        continue;
      }
      retryNote = null;
      costUsd = (costUsd ?? 0) + (result.costUsd ?? 0);
      const recipe = withAnchors(
        grids,
        scope && base ? mergeRepair(base.recipe, result.output, scope) : result.output,
      );
      const assessment = assess(grids, recipe);
      attempts.push({
        model,
        issues: [
          ...assessment.applied.problems.map(({ message }) => ({
            severity: "blocking" as const,
            code: "partial_read" as const,
            message,
          })),
          ...assessment.issues,
        ],
        costUsd: result.costUsd,
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
      });
      if (!best || assessment.healthy || assessment.faults < best.assessment.faults) {
        best = { recipe, assessment, source: scope ? "repaired" : "generated" };
      }
      if (assessment.healthy) {
        healthy = true;
        if (supplierKey && store) {
          await store.save({ supplierKey, signature, recipe, model });
        }
        break;
      }
      // El siguiente intento repara la mejor hasta ahora, no empieza de cero.
      base = { recipe: best.recipe, assessment: best.assessment, newSheets: [] };
      feedback = `Tu plantilla anterior no encaja. Problemas:\n${failureText(assessment)}\nCorrígela.`;
    }
  }
  if (!best) throw new SheetRecipeUnavailableError();
  source = best.source;

  const { applied, issues: assessed } = best.assessment;
  const extraction = {
    ...applied.extraction,
    supplierName: applied.extraction.supplierName ?? supplierName,
    skipped: [...applied.extraction.skipped, ...workbook.skipped.map((sheet) => `${sheet} (no leída)`)],
  };
  const proposed = toProposedRates(extraction, null).map((row, index) => ({
    ...row,
    sourceExcerpt: applied.excerpts[index] ?? row.sourceExcerpt,
  }));
  const problems = applied.problems.map(({ message }) => message);
  const issues: RateIssue[] = [
    ...problems.map((message) => ({
      severity: "blocking" as const,
      code: "partial_read" as const,
      message: `La plantilla no encaja: ${message}`,
    })),
    ...assessed.filter(
      ({ code }) => !(code === "no_rates" && toProposedCommissions(extraction).length > 0),
    ),
    ...applied.notes.map((message) => ({
      severity: "warning" as const,
      code: "partial_read" as const,
      message,
    })),
  ];
  const summary = { source, tables: best.recipe.tables.length, problems, definition: best.recipe };

  const inScope = proposed.filter(isInScope).length;
  if (inScope === 0 && toProposedCommissions(extraction).length === 0 && problems.length === 0) {
    return {
      result: {
        status: "out_of_scope",
        reason: `No trae precios fijos de 2.0TD${extraction.skipped.length ? ` (${extraction.skipped.join(", ")})` : ""}.`,
        classification: { supplierName, hasPrices: true, hasCommissions: false, accessTariffs: [], pricing: [] },
        costUsd,
      },
      recipe: summary,
    };
  }

  return {
    result: {
      status: hasBlockingIssues(issues) ? "needs_review" : "ok",
      classification: null,
      extraction,
      proposed,
      issues,
      attempts,
      costUsd,
    },
    recipe: summary,
  };
}
