/**
 * Copia deliberada de la parte pura de
 * `src/comparativas/utils/abarca-documents.ts`.
 *
 * Este servicio se despliega por separado (Cloud Run) y no comparte el
 * `node_modules` ni el build del CRM, así que no puede importar de `src/`. Si
 * cambian los formatos aceptados, hay que tocar los dos sitios: el CRM sigue
 * siendo la fuente de la verdad.
 */

export const DOCUMENT_FIELDS = [
  "comparativa_pdf",
  "dni_photo_front",
  "dni_photo_back",
  "justo_titulo",
];

const DATA_URI_PREFIX = /^data:[^;,]*;base64,/i;
const BASE64_ALPHABET = /^[A-Za-z0-9+/\-_]*={0,2}$/;
const PDF_SNIFF_WINDOW = 1024;

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PDF_MAGIC = Buffer.from("%PDF-", "latin1");

const EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** @param {string} value */
export function decodeDocumentBase64(value) {
  const compact = value.replace(DATA_URI_PREFIX, "").replace(/\s+/g, "");
  if (compact.length === 0 || !BASE64_ALPHABET.test(compact)) return null;

  const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  if (remainder === 1) return null;
  const padded =
    remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);

  const buffer = Buffer.from(padded, "base64");
  return buffer.length > 0 ? buffer : null;
}

/** @param {Buffer} buffer */
export function sniffDocumentContentType(buffer) {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return "image/png";
  }
  if (buffer.subarray(0, PDF_SNIFF_WINDOW).indexOf(PDF_MAGIC) !== -1) {
    return "application/pdf";
  }
  return null;
}

/** @param {string | null} contentType */
export function extensionFor(contentType) {
  return (contentType && EXTENSIONS[contentType]) || "bin";
}
