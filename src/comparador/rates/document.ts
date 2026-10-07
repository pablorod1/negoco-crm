import type { FilePart, TextPart } from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";
import { readWorkbook, type SheetGrid } from "./sheets/grid";

/** Lo que llega a una ingesta: un archivo o un texto (pegado o cuerpo de correo). */
export type RateSource =
  | { kind: "file"; name: string; mime: string; data: Uint8Array }
  | { kind: "text"; text: string; html?: boolean };

export interface PreparedDocument {
  format: "pdf" | "image" | "sheet" | "text";
  /**
   * Texto del documento para clasificar y para comprobar que cada cifra
   * extraída aparece en él. `null` en imágenes y PDF escaneados.
   */
  text: string | null;
  /** Partes del mensaje que se envían a la IA. */
  parts: (TextPart | FilePart)[];
  /** Caracteres de texto enviados, para estimar el coste. */
  sentChars: number;
  pages: number | null;
  /**
   * Celdas de un Excel o CSV. Si están, el documento se lee con una plantilla
   * (las cifras salen de las celdas) en vez de pedirle las filas a la IA.
   */
  grids?: SheetGrid[];
}

/** Tope de texto por documento: el Excel completo de Axpo ronda 85.000 caracteres. */
export const MAX_DOCUMENT_CHARS = 120_000;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SHEET_EXTENSIONS = /\.(xlsx|xlsm|xls|ods)$/i;
const TARIFF_20TD = /2[.,]?0\s?TD|20TD/i;

export class UnsupportedDocumentError extends Error {
  constructor(name: string) {
    super(`Formato no admitido: ${name}. Sube un PDF, un Excel, un CSV o una imagen.`);
    this.name = "UnsupportedDocumentError";
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[͏‌­]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Hojas de cálculo a texto separado por tabuladores, solo valores (nunca
 * fórmulas ni macros). Con comas, «43.99,28.99» se confundiría con un número.
 * Las hojas que mencionan la 2.0TD van primero, por si hay que recortar.
 */
export function readSheets(data: Uint8Array): { name: string; csv: string }[] {
  const book = XLSX.read(data, {
    type: "array",
    cellFormula: false,
    cellHTML: false,
    bookVBA: false,
  });
  const sheets = book.SheetNames.map((name) => {
    const csv = XLSX.utils
      .sheet_to_csv(book.Sheets[name], { FS: "\t", blankrows: false, strip: true })
      .split("\n")
      .filter((line) => line.replace(/\t/g, "").trim() !== "")
      .join("\n");
    return { name, csv };
  }).filter(({ csv }) => csv.length > 0);

  sheets.sort(
    (left, right) =>
      Number(TARIFF_20TD.test(right.csv)) - Number(TARIFF_20TD.test(left.csv)),
  );
  return sheets;
}

export function sheetToText(data: Uint8Array): string {
  return readSheets(data)
    .map(({ name, csv }) => `### Hoja: ${name}\n${csv}`)
    .join("\n\n");
}

async function pdfToText(data: Uint8Array) {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = text.map(
    (page, index) => `--- Página ${index + 1} ---\n${page.trim()}`,
  );
  const chars = text.join("").replace(/\s+/g, "").length;
  // Menos de 200 caracteres por página: escaneado o casi todo imagen.
  return {
    totalPages,
    text: chars >= 200 * Math.max(totalPages, 1) ? pages.join("\n\n") : null,
  };
}

function truncate(text: string): string {
  return text.length > MAX_DOCUMENT_CHARS
    ? `${text.slice(0, MAX_DOCUMENT_CHARS)}\n[… documento recortado …]`
    : text;
}

export async function prepareDocument(source: RateSource): Promise<PreparedDocument> {
  if (source.kind === "text") {
    const text = truncate(source.html ? htmlToText(source.text) : source.text.trim());
    return {
      format: "text",
      text,
      parts: [{ type: "text", text }],
      sentChars: text.length,
      pages: null,
    };
  }

  const { name, mime, data } = source;
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
    const { totalPages, text } = await pdfToText(data);
    // El PDF va entero a la IA, que lee las tablas mejor que nuestro texto; el
    // texto sirve para clasificar y para comprobar las cifras.
    return {
      format: "pdf",
      text,
      parts: [{ type: "file", data, mediaType: "application/pdf", filename: name }],
      sentChars: 0,
      pages: totalPages,
    };
  }

  if (IMAGE_TYPES.has(mime)) {
    return {
      format: "image",
      text: null,
      parts: [{ type: "file", data, mediaType: mime }],
      sentChars: 0,
      pages: 1,
    };
  }

  const isCsv = mime === "text/csv" || /\.csv$/i.test(name);
  if (isCsv || SHEET_EXTENSIONS.test(name) || mime.includes("spreadsheet") || mime.includes("excel")) {
    // Los Excel se leen con plantilla: a la IA no le llega el texto, sino la
    // forma del libro (ver sheets/read.ts).
    return {
      format: "sheet",
      text: truncate(sheetToText(data)),
      parts: [],
      sentChars: 0,
      pages: null,
      grids: readWorkbook(data),
    };
  }

  if (mime.startsWith("text/") || /\.(csv|txt|html?)$/i.test(name)) {
    const raw = new TextDecoder().decode(data);
    const isHtml = mime === "text/html" || /\.html?$/i.test(name);
    const text = truncate(isHtml ? htmlToText(raw) : raw.trim());
    return {
      format: "text",
      text,
      parts: [{ type: "text", text }],
      sentChars: text.length,
      pages: null,
    };
  }

  throw new UnsupportedDocumentError(name);
}
