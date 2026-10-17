import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Peticiones del backoffice de Negoco a la API interna del CRM
 * (/api/internal/…). Van firmadas con NEGOCO_BACKOFFICE_SECRET, el mismo en los
 * dos proyectos de Vercel:
 *
 *   x-negoco-timestamp: segundos Unix
 *   x-negoco-reviewer:  correo de quien revisa en el backoffice
 *   x-negoco-signature: HMAC-SHA256 en hex de
 *                       «timestamp\nMÉTODO\nruta?query\nrevisor\ncuerpo»
 *
 * El backoffice firma igual (negoco-backoffice: src/lib/crm-api.ts).
 */

export const BACKOFFICE_HEADERS = {
  timestamp: "x-negoco-timestamp",
  reviewer: "x-negoco-reviewer",
  signature: "x-negoco-signature",
} as const;

/** Margen entre la firma y nuestro reloj. */
const TOLERANCE_SECONDS = 5 * 60;

export function signBackofficeRequest({
  secret,
  timestamp,
  method,
  path,
  reviewer,
  body,
}: {
  secret: string;
  timestamp: string;
  method: string;
  path: string;
  reviewer: string;
  body: string;
}): string {
  return createHmac("sha256", secret)
    .update([timestamp, method.toUpperCase(), path, reviewer, body].join("\n"))
    .digest("hex");
}

/**
 * Quién revisa, si la petición viene del backoffice; `null` si la firma no es
 * válida, ha caducado o falta el secreto.
 */
export function verifyBackofficeRequest(
  request: Request,
  body: string,
  { secret = process.env.NEGOCO_BACKOFFICE_SECRET, now = Date.now() }: { secret?: string; now?: number } = {},
): { reviewer: string } | null {
  const timestamp = request.headers.get(BACKOFFICE_HEADERS.timestamp);
  const reviewer = request.headers.get(BACKOFFICE_HEADERS.reviewer)?.trim().toLowerCase();
  const signature = request.headers.get(BACKOFFICE_HEADERS.signature);
  if (!secret || !timestamp || !reviewer || !signature) return null;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS) return null;
  if (!/^[^@\s]+@[^@\s]+$/.test(reviewer)) return null;

  const url = new URL(request.url);
  const expected = Buffer.from(
    signBackofficeRequest({ secret, timestamp, method: request.method, path: `${url.pathname}${url.search}`, reviewer, body }),
    "hex",
  );
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected) ? { reviewer } : null;
}

/** Cómo queda registrado en el tenant quien decide desde el backoffice. */
export const reviewerUserId = (reviewer: string) => `negoco:${reviewer}`;
