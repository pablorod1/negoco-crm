import { createHash, randomUUID } from "node:crypto";
import {
  DISCARDED_FIELDS,
  DOCUMENT_FIELDS,
  MAX_INLINE_FIELD_BYTES,
  decodeDocumentBase64,
  extensionFor,
  sniffDocumentContentType,
} from "./documents.js";

export const QUARANTINE_CONTENT_TYPE = "application/octet-stream";

/**
 * Saca los documentos del payload y los deja en Storage, dejando en su lugar
 * una referencia. Lo que sale de aquí es siempre pequeño: es lo único que
 * llega a Vercel, que rechaza cuerpos de más de 4,5MB antes de ejecutar nada.
 *
 * Un documento que no se puede decodificar NO se descarta: se sube tal cual
 * para que el CRM lo ponga en cuarentena y quede recuperable.
 *
 * Hay tres tratos distintos, y el orden importa:
 *
 *  1. `DISCARDED_FIELDS` se borra sin subirse. Es contenido que el CRM ya
 *     tiene por otra vía y no queremos ni almacenar.
 *  2. `DOCUMENT_FIELDS` se sube y se sustituye por una referencia. El CRM los
 *     conoce por nombre y sabe qué son.
 *  3. Cualquier OTRO campo de texto que pese como un fichero se sube igual y
 *     se marca como desconocido. No sabemos qué significa, así que el CRM no
 *     lo adjunta a nada, pero no revienta la entrega ni se pierde el fichero.
 *     Esta regla es la que evita repetir el incidente de `factura`: la lista
 *     de campos conocidos siempre va por detrás de lo que manda Abarca.
 *
 * @param {Record<string, unknown>} payload
 * @param {{
 *   prefix: string,
 *   upload: (path: string, bytes: Buffer, contentType: string) =>
 *     Promise<{ url: string }>,
 * }} options
 */
export async function stageDocuments(payload, { prefix, upload }) {
  const slim = { ...payload };
  const staged = [];
  const discarded = [];

  for (const field of DISCARDED_FIELDS) {
    const value = payload[field];
    if (typeof value !== "string" || value.length === 0) continue;

    delete slim[field];
    discarded.push({ field, chars: value.length });
  }

  for (const field of DOCUMENT_FIELDS) {
    const value = payload[field];
    if (typeof value !== "string" || value.length === 0) continue;

    slim[field] = await stageValue(value, `${prefix}/${field}`, upload);
    staged.push({ field, ...slim[field] });
  }

  // El barrido genérico va al final, sobre lo que ya quedó en `slim`: los
  // campos conocidos son objetos a estas alturas y no se vuelven a mirar.
  for (const [field, value] of Object.entries(slim)) {
    if (typeof value !== "string") continue;
    if (Buffer.byteLength(value) <= MAX_INLINE_FIELD_BYTES) continue;

    const path = `${prefix}/desconocido_${sanitizeSegment(field)}`;
    const ref = await stageValue(value, path, upload);
    slim[field] = { ...ref, unknown_field: true };
    staged.push({ field, ...ref, unknown_field: true });
  }

  return { slim, staged, discarded };
}

/**
 * Sube un valor en base64 y devuelve la referencia que lo sustituye.
 *
 * @param {string} value
 * @param {string} pathWithoutExtension
 * @param {(path: string, bytes: Buffer, contentType: string) =>
 *   Promise<{ url: string }>} upload
 */
async function stageValue(value, pathWithoutExtension, upload) {
  const decoded = decodeDocumentBase64(value);
  // Si ni siquiera es base64, se guardan los bytes crudos: perder el
  // fichero es peor que guardarlo sin saber qué es.
  const bytes = decoded ?? Buffer.from(value, "utf8");
  const sniffed = decoded ? sniffDocumentContentType(bytes) : null;
  const contentType = sniffed ?? QUARANTINE_CONTENT_TYPE;
  const path = `${pathWithoutExtension}.${extensionFor(sniffed)}`;

  const { url } = await upload(path, bytes, contentType);
  return {
    path,
    url,
    bytes: bytes.length,
    content_type: contentType,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/**
 * @param {string} tenant
 * @param {string} comparativaId
 * @param {string} root
 */
export function buildStagingPrefix(tenant, comparativaId, root) {
  return `${root}/${sanitizeSegment(tenant)}/${sanitizeSegment(
    comparativaId,
  )}/${randomUUID()}`;
}

/** @param {string} value */
export function sanitizeSegment(value) {
  const sanitized = value.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 128);
  return sanitized || "unknown";
}
