import type { FilePart, TextPart } from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

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
   * Partes que se extraen por separado (hojas de un Excel grande). Con más de
   * una, cada parte va en su propia llamada: un anexo como el de Axpo trae más
   * filas de las que caben en una respuesta.
   */
  chunks?: DocumentChunk[];
  /** Hojas que no se leen por su nombre (indexadas, gas). */
  skippedSections?: string[];
}

export interface DocumentChunk {
  label: string;
  text: string;
}

/**
 * Texto por llamada. En el Excel de Axpo cada línea trae tres niveles (N1–N3),
 * así que 20.000 letras podían pasar de 100 filas y cortar la respuesta;
 * 10.000 es, en la práctica, una hoja por llamada.
 */
export const CHUNK_CHARS = 10_000;

/**
 * Hojas que no se leen por su nombre: indexadas y gas. La v1 no las guarda y
 * leerlas cuesta: en el Excel de Axpo son 5 de 13 hojas.
 */
const SKIPPED_SHEET = /index|omie|\bpool\b|din[aá]mica|pass.?through|\bgas\b|\bRL\.?\s?\d/i;

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

/**
 * Agrupa las hojas útiles en partes de hasta CHUNK_CHARS. Una hoja más larga
 * se parte por líneas, repitiendo su cabecera para que la IA sepa qué producto es.
 */
export function chunkSheets(sheets: readonly { name: string; csv: string }[]): {
  chunks: DocumentChunk[];
  skipped: string[];
} {
  const skipped: string[] = [];
  const pieces: DocumentChunk[] = [];
  for (const { name, csv } of sheets) {
    if (SKIPPED_SHEET.test(name)) {
      skipped.push(name);
      continue;
    }
    const header = `### Hoja: ${name}`;
    if (csv.length <= CHUNK_CHARS) {
      pieces.push({ label: name, text: `${header}\n${csv}` });
      continue;
    }
    const lines = csv.split("\n");
    let current: string[] = [];
    let size = 0;
    let part = 1;
    for (const line of lines) {
      if (size + line.length > CHUNK_CHARS && current.length) {
        pieces.push({ label: `${name} (${part++})`, text: `${header} (continúa)\n${current.join("\n")}` });
        current = [];
        size = 0;
      }
      current.push(line);
      size += line.length + 1;
    }
    if (current.length) {
      pieces.push({ label: part > 1 ? `${name} (${part})` : name, text: `${header}\n${current.join("\n")}` });
    }
  }

  // Hojas pequeñas juntas, para no gastar una llamada en cada una.
  const chunks: DocumentChunk[] = [];
  for (const piece of pieces) {
    const last = chunks.at(-1);
    if (last && last.text.length + piece.text.length + 2 <= CHUNK_CHARS) {
      last.label = `${last.label} · ${piece.label}`;
      last.text = `${last.text}\n\n${piece.text}`;
    } else {
      chunks.push({ ...piece });
    }
  }
  return { chunks, skipped };
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

  if (SHEET_EXTENSIONS.test(name) || mime.includes("spreadsheet") || mime.includes("excel")) {
    const sheets = readSheets(data);
    const text = truncate(sheetToText(data));
    const { chunks, skipped } = chunkSheets(sheets);
    const sent = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
    return {
      format: "sheet",
      // El texto completo sirve para comprobar las cifras; a la IA van las partes.
      text,
      parts: chunks.length === 1 ? [{ type: "text", text: chunks[0].text }] : [],
      sentChars: sent,
      pages: null,
      chunks,
      skippedSections: skipped,
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
