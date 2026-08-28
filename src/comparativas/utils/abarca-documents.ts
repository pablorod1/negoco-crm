/**
 * Resolución de los documentos que Abarca envía en el webhook.
 *
 * Cada documento se resuelve por separado y a propósito: un fichero que no
 * podamos interpretar nunca debe invalidar la entrega entera ni descartarse.
 * Lo que no se reconoce se marca como `quarantined` y se guarda igual, para
 * poder recuperarlo a mano desde Storage.
 *
 * Los documentos llegan por dos vías:
 *  - `inline`: base64 dentro del webhook (Abarca apuntando directo al CRM).
 *  - `staged`: ya subidos a Storage por el proxy de ingesta, que sortea el
 *    límite de 4,5MB de cuerpo de petición de Vercel.
 */

import type { AbarcaWebhookDocument } from "@/comparativas/types/abarca.types";

export const ABARCA_DOCUMENT_FIELDS = [
  "comparativa_pdf",
  "dni_photo_front",
  "dni_photo_back",
  "justo_titulo",
] as const;

export type AbarcaDocumentField = (typeof ABARCA_DOCUMENT_FIELDS)[number];

export const QUARANTINE_CONTENT_TYPE = "application/octet-stream";

/** Tope por documento subido por el proxy. Cloud Run admite 32MB de cuerpo. */
export const MAX_STAGED_DOCUMENT_BYTES = 25 * 1024 * 1024;
/** Tope por documento en base64. Vercel corta el cuerpo antes de los 4,5MB. */
export const MAX_INLINE_DOCUMENT_BYTES = 4 * 1024 * 1024;

const KNOWN_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const EXTENSIONS_BY_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const BASE_FILENAMES: Record<AbarcaDocumentField, string> = {
  comparativa_pdf: "estudio",
  dni_photo_front: "dni_frontal",
  dni_photo_back: "dni_reverso",
  justo_titulo: "justo_titulo",
};

const DATA_URI_PREFIX = /^data:[^;,]*;base64,/i;
const BASE64_ALPHABET = /^[A-Za-z0-9+/\-_]*={0,2}$/;
const PDF_SNIFF_WINDOW = 1024;

export interface StagedDocumentRef {
  path: string;
  url: string;
  bytes: number;
  content_type: string;
  sha256?: string;
}

export type AbarcaDocumentSource =
  | { kind: "inline"; bytes: Buffer }
  | { kind: "staged"; ref: StagedDocumentRef };

export interface AbarcaDocumentPlan {
  contentType: string;
  extension: string;
  field: AbarcaDocumentField;
  filename: string;
  quarantined: boolean;
  reason: string | null;
  size: number;
  source: AbarcaDocumentSource;
}

export type AbarcaDocumentOutcome =
  | { status: "planned"; plan: AbarcaDocumentPlan }
  | { status: "missing" }
  | { status: "invalid"; reason: string };

export function sanitizeFileSegment(
  value: string | null | undefined,
): string {
  const sanitized = (value ?? "comparativa")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return sanitized || "comparativa";
}

/**
 * Decodifica base64 tolerando lo que manda un cliente real: prefijo de data
 * URI, saltos de línea, alfabeto base64url y padding ausente. La validación
 * anterior exigía base64 canónico y rechazaba la entrega entera por esto.
 */
export function decodeDocumentBase64(value: string): Buffer | null {
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

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PDF_MAGIC = Buffer.from("%PDF-", "latin1");

/**
 * Identifica el tipo por los bytes, no por el nombre del campo: el comparador
 * acepta JPG, PNG y PDF, así que un `dni_photo_front` puede ser un PDF.
 */
export function sniffDocumentContentType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return "image/png";
  }
  const pdfIndex = buffer
    .subarray(0, PDF_SNIFF_WINDOW)
    .indexOf(PDF_MAGIC);
  if (pdfIndex !== -1) return "application/pdf";

  return null;
}

function extensionFor(contentType: string): string {
  return EXTENSIONS_BY_CONTENT_TYPE[contentType] ?? "bin";
}

function buildFilename(
  field: AbarcaDocumentField,
  extension: string,
  empresa: string | null | undefined,
): string {
  if (field === "comparativa_pdf") {
    return `estudio_${sanitizeFileSegment(empresa)}.${extension}`;
  }
  return `${BASE_FILENAMES[field]}.${extension}`;
}

function isStagedRef(value: unknown): value is StagedDocumentRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.path === "string" &&
    candidate.path.length > 0 &&
    typeof candidate.url === "string" &&
    candidate.url.length > 0 &&
    typeof candidate.bytes === "number" &&
    Number.isSafeInteger(candidate.bytes) &&
    candidate.bytes > 0 &&
    typeof candidate.content_type === "string"
  );
}

function planned(
  plan: AbarcaDocumentPlan,
): Extract<AbarcaDocumentOutcome, { status: "planned" }> {
  return { status: "planned", plan };
}

function resolveStaged(
  field: AbarcaDocumentField,
  ref: StagedDocumentRef,
  empresa: string | null | undefined,
): AbarcaDocumentOutcome {
  if (ref.bytes > MAX_STAGED_DOCUMENT_BYTES) {
    return {
      status: "invalid",
      reason: `staged_too_large:${ref.bytes}`,
    };
  }

  const known = KNOWN_CONTENT_TYPES.has(ref.content_type);
  const contentType = known ? ref.content_type : QUARANTINE_CONTENT_TYPE;
  const extension = known ? extensionFor(contentType) : "bin";

  return planned({
    contentType,
    extension,
    field,
    filename: buildFilename(field, extension, empresa),
    quarantined: !known,
    reason: known ? null : `unknown_content_type:${ref.content_type}`,
    size: ref.bytes,
    source: { kind: "staged", ref },
  });
}

function resolveInline(
  field: AbarcaDocumentField,
  value: string,
  empresa: string | null | undefined,
): AbarcaDocumentOutcome {
  const bytes = decodeDocumentBase64(value);
  if (!bytes) return { status: "invalid", reason: "undecodable_base64" };
  if (bytes.length > MAX_INLINE_DOCUMENT_BYTES) {
    return {
      status: "invalid",
      reason: `inline_too_large:${bytes.length}`,
    };
  }

  const sniffed = sniffDocumentContentType(bytes);
  const contentType = sniffed ?? QUARANTINE_CONTENT_TYPE;
  const extension = sniffed ? extensionFor(contentType) : "bin";

  return planned({
    contentType,
    extension,
    field,
    filename: buildFilename(field, extension, empresa),
    quarantined: sniffed === null,
    reason: sniffed === null ? "unrecognized_document_bytes" : null,
    size: bytes.length,
    source: { kind: "inline", bytes },
  });
}

export function resolveAbarcaDocument(
  field: AbarcaDocumentField,
  value: unknown,
  empresa: string | null | undefined,
): AbarcaDocumentOutcome {
  if (value === null || value === undefined) return { status: "missing" };
  if (isStagedRef(value)) return resolveStaged(field, value, empresa);
  if (typeof value === "string") {
    if (value.length === 0) return { status: "missing" };
    return resolveInline(field, value, empresa);
  }
  return { status: "invalid", reason: "unsupported_document_shape" };
}

export function resolveAbarcaDocuments(
  payload: Record<string, unknown>,
  empresa: string | null | undefined,
): Map<AbarcaDocumentField, AbarcaDocumentOutcome> {
  const outcomes = new Map<AbarcaDocumentField, AbarcaDocumentOutcome>();
  for (const field of ABARCA_DOCUMENT_FIELDS) {
    outcomes.set(field, resolveAbarcaDocument(field, payload[field], empresa));
  }
  return outcomes;
}

/**
 * El estado de los documentos viaja dentro de `abarca_estudios.raw_payload`,
 * igual que ya hace el resumen de SIPS con `apolo_sips`. Así se escribe en la
 * misma transacción que la entrega (no puede quedar descuadrado) y no hace
 * falta una tabla aparte con su migración por tenant.
 *
 * De paso saca los base64 del payload guardado: sin esto cada entrega metía
 * varios MB en la base de datos del tenant.
 */
export function attachDocumentsToRawPayload(
  body: unknown,
  documents: readonly AbarcaWebhookDocument[],
): unknown {
  const clone: Record<string, unknown> =
    body && typeof body === "object" && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>) }
      : {};

  for (const field of ABARCA_DOCUMENT_FIELDS) {
    if (field in clone) clone[field] = null;
  }
  clone.abarca_documents = documents;
  return clone;
}

export function parseAbarcaDocuments(
  rawPayload: string,
): AbarcaWebhookDocument[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return [];
  }

  const documents = (parsed as { abarca_documents?: unknown })
    ?.abarca_documents;
  if (!Array.isArray(documents)) return [];

  return documents.filter(isAbarcaWebhookDocument);
}

export function mergeDocumentsIntoRawPayload(
  rawPayload: string,
  documents: readonly AbarcaWebhookDocument[],
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    parsed = {};
  }

  const base =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const merged = new Map(
    parseAbarcaDocuments(rawPayload).map((document) => [
      document.field,
      document,
    ]),
  );
  for (const document of documents) {
    merged.set(document.field, document);
  }

  return JSON.stringify({
    ...base,
    abarca_documents: [...merged.values()],
  });
}

const DOCUMENT_STATUSES = new Set([
  "stored",
  "quarantined",
  "missing",
  "invalid",
]);

function isAbarcaWebhookDocument(
  value: unknown,
): value is AbarcaWebhookDocument {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    ABARCA_DOCUMENT_FIELDS.includes(
      candidate.field as AbarcaDocumentField,
    ) && DOCUMENT_STATUSES.has(candidate.status as string)
  );
}
