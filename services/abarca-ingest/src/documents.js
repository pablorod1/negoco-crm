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

/**
 * Campos que Abarca manda y el CRM no quiere.
 *
 * `factura` es la factura del cliente que el comercial sube al comparador, y
 * el comparador nos la devuelve tal cual. Es el campo más grande del payload
 * —está en todas las entregas, de 250KB a 3,3MB— y era el que hacía que
 * incluso después de sacar los documentos siguiéramos por encima del límite
 * de Vercel. En el CRM ya está: es el mismo PDF que el comercial adjuntó a la
 * comparativa. Se descarta aquí, sin subirlo, para no pagar ni el ancho de
 * banda ni el almacenamiento de una copia que no se usa.
 */
export const DISCARDED_FIELDS = ["factura"];

/**
 * Por encima de esto, un campo de texto deja de ser un dato y es un fichero.
 * Ningún campo legítimo del estudio (observaciones, servicios, los desgloses
 * de consumo) se acerca: el mayor que hemos visto ronda los 3KB.
 */
export const MAX_INLINE_FIELD_BYTES = 64 * 1024;

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
