import { createHash, randomUUID } from "node:crypto";
import {
  DOCUMENT_FIELDS,
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

  for (const field of DOCUMENT_FIELDS) {
    const value = payload[field];
    if (typeof value !== "string" || value.length === 0) continue;

    const decoded = decodeDocumentBase64(value);
    // Si ni siquiera es base64, se guardan los bytes crudos: perder el
    // fichero es peor que guardarlo sin saber qué es.
    const bytes = decoded ?? Buffer.from(value, "utf8");
    const sniffed = decoded ? sniffDocumentContentType(bytes) : null;
    const contentType = sniffed ?? QUARANTINE_CONTENT_TYPE;
    const path = `${prefix}/${field}.${extensionFor(sniffed)}`;

    const { url } = await upload(path, bytes, contentType);
    const ref = {
      path,
      url,
      bytes: bytes.length,
      content_type: contentType,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };

    slim[field] = ref;
    staged.push({ field, ...ref });
  }

  return { slim, staged };
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
