import { readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createWorker, OEM, PSM, type Block } from "tesseract.js";
import { renderPageAsImage } from "unpdf";

/**
 * OCR local de facturas que son imagen (fotos y PDF escaneados), con
 * Tesseract en el propio servidor: la imagen no sale del CRM. El texto que
 * devuelve sigue el mismo camino que el de un PDF: se tapan los datos
 * personales y a la IA solo llegan conceptos y cifras.
 */

/** Modelo de español «best_int»: el más preciso de Tesseract, cuantizado (2 MB). */
const LANG_PATH = path.join(process.cwd(), "node_modules/@tesseract.js-data/spa/4.0.0_best_int");

/**
 * El script del worker, en la copia de tesseract.js que guarda pnpm. En
 * Vercel, `node_modules/tesseract.js` es una carpeta con solo parte de sus
 * archivos y el worker no encontraba los suyos (`Cannot find module '..'`);
 * la de `.pnpm`, con sus dependencias al lado, va entera en la función
 * (`outputFileTracingIncludes` de next.config). Sin pnpm, la de siempre.
 */
function workerPath(): string | undefined {
  const store = path.join(process.cwd(), "node_modules/.pnpm");
  try {
    const folder = readdirSync(store).find((name) => name.startsWith("tesseract.js@"));
    return folder ? path.join(store, folder, "node_modules/tesseract.js/src/worker-script/node/index.js") : undefined;
  } catch {
    return undefined;
  }
}

/** TEMPORAL: cómo quedan en la función las carpetas de tesseract.js. */
function describeLayout(): string {
  const list = (dir: string, filter: (name: string) => boolean = () => true) => {
    try {
      return readdirSync(path.join(process.cwd(), dir)).filter(filter).join(",");
    } catch (error) {
      return `(${(error as NodeJS.ErrnoException).code})`;
    }
  };
  const tesseract = (name: string) => /tesseract|bmp-js|zlibjs|wasm-feature|idb-keyval|is-url|regenerator/.test(name);
  return [
    `cwd=${process.cwd()}`,
    `node_modules: ${list("node_modules", tesseract)}`,
    `.pnpm: ${list("node_modules/.pnpm", tesseract)}`,
    `.pnpm/node_modules: ${list("node_modules/.pnpm/node_modules", tesseract)}`,
    `tesseract.js/src/worker-script: ${list("node_modules/tesseract.js/src/worker-script")}`,
    `tesseract.js/node_modules: ${list("node_modules/tesseract.js/node_modules")}`,
    `.next/node_modules: ${list(".next/node_modules", tesseract)}`,
  ].join(" | ");
}

/** Páginas que se leen de un PDF escaneado: el detalle de la factura está al principio. */
export const MAX_OCR_PAGES = 4;
/** Ancho al que se lleva cada página: Tesseract lee mejor el texto de unos 30 px de alto. */
const TARGET_WIDTH = 2400;

export interface OcrResult {
  text: string;
  /** Confianza media de Tesseract (0–100). */
  confidence: number;
  pages: number;
}

export class UnreadableImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreadableImageError";
  }
}

/**
 * Prepara una imagen para el OCR: la endereza según la cámara (EXIF), la pasa
 * a grises, estira el contraste y la lleva a un ancho legible.
 */
export async function prepareImage(data: Uint8Array): Promise<Buffer> {
  try {
    const image = sharp(data, { failOn: "none" }).rotate();
    const { width = TARGET_WIDTH } = await image.metadata();
    return await image
      .resize({ width: Math.min(Math.max(width, TARGET_WIDTH), 3600), withoutEnlargement: false })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
  } catch {
    throw new UnreadableImageError(
      "No se puede abrir la imagen. Si es una foto HEIC del iPhone, envíala como JPG (por WhatsApp o «Exportar como JPG») o pide la factura en PDF.",
    );
  }
}

/** Las primeras páginas de un PDF escaneado, como imágenes. */
export async function pdfPagesAsImages(data: Uint8Array, pages: number): Promise<Buffer[]> {
  const images: Buffer[] = [];
  for (let page = 1; page <= Math.min(pages, MAX_OCR_PAGES); page++) {
    const png = await renderPageAsImage(new Uint8Array(data), page, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 3,
    });
    images.push(Buffer.from(png));
  }
  return images;
}

/** Separa columnas dentro de una línea; `redactInvoiceText` tapa cada una por separado. */
export const COLUMN_BREAK = "\t";

interface PlacedWord {
  text: string;
  x0: number;
  x1: number;
  cy: number;
  height: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/**
 * Rehace las líneas de la página con la posición de cada palabra. Tesseract
 * junta en una línea columnas que están a la misma altura (el nombre del
 * titular junto a «Potencia punta: 4,6 kW»); aquí, un hueco de más de un par
 * de letras entre dos palabras es un cambio de columna y se marca con
 * `COLUMN_BREAK`, para que el anonimizado mire cada columna por separado.
 */
export function layoutWords(blocks: readonly Block[]): string {
  const words: PlacedWord[] = [];
  for (const block of blocks)
    for (const paragraph of block.paragraphs)
      for (const line of paragraph.lines)
        for (const word of line.words) {
          const text = word.text.trim();
          if (!text) continue;
          const { x0, x1, y0, y1 } = word.bbox;
          words.push({ text, x0, x1, cy: (y0 + y1) / 2, height: y1 - y0 });
        }
  if (words.length === 0) return "";

  const unit = median(words.map(({ height }) => height)) || 20;
  const rows: PlacedWord[][] = [];
  for (const word of [...words].sort((left, right) => left.cy - right.cy)) {
    const row = rows.find((candidate) => Math.abs(candidate[0].cy - word.cy) <= unit * 0.5);
    if (row) row.push(word);
    else rows.push([word]);
  }

  return rows
    .sort((left, right) => left[0].cy - right[0].cy)
    .map((row) => {
      const ordered = row.sort((left, right) => left.x0 - right.x0);
      let text = "";
      let end: number | null = null;
      for (const word of ordered) {
        // Barras y rayas sueltas suelen ser los filetes de la maqueta: también separan columnas.
        const rule = /^[|—–_]+$/.test(word.text);
        const gap = end === null ? 0 : word.x0 - end;
        if (text) text += rule || gap > unit * 1.5 ? COLUMN_BREAK : " ";
        if (!rule) text += word.text;
        end = word.x1;
      }
      return text
        .split(COLUMN_BREAK)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join(COLUMN_BREAK);
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Tope del OCR entero; en local, dos páginas tardan unos 5 s. Si el worker de
 * Tesseract no arranca (por ejemplo, le falta un archivo en el servidor), su
 * promesa no acaba nunca: mejor un error claro que agotar la función.
 */
export const OCR_TIMEOUT_MS = 60_000;

export class OcrTimeoutError extends Error {
  constructor(
    timeoutMs: number,
    /** Por dónde iba Tesseract, para saber en qué paso se quedó. */
    readonly steps: string[],
  ) {
    super(`El OCR no ha terminado en ${Math.round(timeoutMs / 1000)} s`);
    this.name = "OcrTimeoutError";
  }
}

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

async function recognizeAll(
  images: readonly Buffer[],
  started: (worker: OcrWorker) => void,
  step: (text: string) => void,
): Promise<OcrResult> {
  let status = "";
  const worker = workerPath();
  step(`workerPath=${worker ?? "por defecto"} | ${describeLayout()}`);
  const ocr = await createWorker("spa", OEM.LSTM_ONLY, {
    langPath: LANG_PATH,
    gzip: true,
    // Sin la copia de pnpm, la ruta por defecto de tesseract.js (no se pasa `undefined`).
    ...(worker ? { workerPath: worker } : {}),
    // Sin caché en disco: en el servidor solo se puede escribir en /tmp.
    cacheMethod: "none",
    logger: ({ status: next, progress }) => {
      if (next !== status) step(next);
      status = next;
      if (progress === 1) step(`${next} ✓`);
    },
    errorHandler: (error: unknown) => step(`error: ${String(error).slice(0, 300)}`),
  });
  started(ocr);
  await ocr.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const texts: string[] = [];
  const confidences: number[] = [];
  for (const image of images) {
    // rotateAuto endereza la foto: con la hoja algo girada, el concepto y su
    // importe caían en renglones distintos.
    const { data } = await ocr.recognize(image, { rotateAuto: true }, { text: false, blocks: true });
    texts.push(layoutWords(data.blocks ?? []));
    confidences.push(data.confidence);
  }
  const confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0;
  return { text: texts.join("\n\n").trim(), confidence, pages: images.length };
}

/** Texto de unas imágenes ya preparadas, página a página, con las columnas marcadas. */
export async function ocrImages(images: readonly Buffer[], timeoutMs = OCR_TIMEOUT_MS): Promise<OcrResult> {
  let worker: OcrWorker | null = null;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const begin = Date.now();
  const steps: string[] = [];
  const job = recognizeAll(
    images,
    (started) => {
      worker = started;
      // Arrancó después del tope: se cierra y lo que siga del OCR falla sin más.
      if (finished) void started.terminate().catch(() => undefined);
    },
    (text) => steps.push(`${Date.now() - begin} ms ${text}`),
  );
  job.catch(() => undefined);
  try {
    return await Promise.race([
      job,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new OcrTimeoutError(timeoutMs, steps)), timeoutMs);
      }),
    ]);
  } finally {
    finished = true;
    clearTimeout(timer);
    await (worker as OcrWorker | null)?.terminate().catch(() => undefined);
  }
}
