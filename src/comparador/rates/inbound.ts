import type { Client } from "@libsql/client";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Buzón de anexos con Resend. Cada tenant tiene una dirección
 * `<tenant>@<COMPARADOR_INBOUND_DOMAIN>` (por ejemplo,
 * beenergy@tarifas.negococloud.es). Resend avisa con un webhook firmado con
 * Svix; el cuerpo y los adjuntos se piden después a su API.
 */

/** Diferencia máxima entre la firma y nuestro reloj, como recomienda Svix. */
const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature({
  secret,
  id,
  timestamp,
  signatureHeader,
  body,
  now = Date.now(),
}: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  now?: number;
}): boolean {
  if (!id || !timestamp || !signatureHeader || !secret) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();

  // La cabecera puede traer varias firmas («v1,abc v1,def») durante una rotación.
  return signatureHeader.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const received = Buffer.from(signature, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

/** Tenant al que va el correo, por la dirección de destino. */
export function tenantFromRecipients(
  recipients: readonly string[],
  domain: string,
): string | null {
  const suffix = `@${domain.toLowerCase()}`;
  for (const raw of recipients) {
    const address = (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();
    if (!address.endsWith(suffix)) continue;
    const local = address.slice(0, -suffix.length).split("+")[0];
    if (/^[a-z0-9-]{2,40}$/.test(local)) return local;
  }
  return null;
}

export interface InboundAttachment {
  id: string;
  filename: string;
  content_type: string;
  content_disposition?: string | null;
  size?: number;
  download_url?: string;
}

const ACCEPTED = /\.(pdf|xlsx|xlsm|xls|csv|png|jpe?g|webp)$/i;
/** Las imágenes de firma y logos de los correos pesan poco y van en línea. */
const MIN_INLINE_IMAGE_BYTES = 60 * 1024;

/** Adjuntos que pueden ser un anexo de precios. */
export function selectAttachments(
  attachments: readonly InboundAttachment[],
  maxBytes: number,
): InboundAttachment[] {
  return attachments.filter((attachment) => {
    if (!ACCEPTED.test(attachment.filename)) return false;
    if (attachment.size !== undefined && attachment.size > maxBytes) return false;
    const isImage = attachment.content_type.startsWith("image/");
    const inline = attachment.content_disposition === "inline";
    if (isImage && inline && (attachment.size ?? 0) < MIN_INLINE_IMAGE_BYTES) return false;
    return true;
  });
}

/** Dirección de un remitente: «Ana <ana@x.es>» da «ana@x.es». */
export function senderAddress(from: string): string {
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

/**
 * Un usuario activo del tenant: sus correos se leen solos. Así cada tenant
 * envía a su buzón desde sus propias cuentas sin tocar ninguna variable de
 * entorno; `COMPARADOR_INBOUND_TRUSTED_SENDERS` queda para remitentes comunes
 * (soporte de Negoco, una comercializadora que envía a todos).
 */
export async function isTenantUser(
  client: Pick<Client, "execute">,
  from: string,
): Promise<boolean> {
  const { rows } = await client.execute({
    sql: "SELECT 1 FROM user WHERE lower(email) = ? AND coalesce(banned, 0) = 0 LIMIT 1",
    args: [senderAddress(from)],
  });
  return rows.length > 0;
}

/** Remitentes de confianza: sus correos se procesan sin esperar a nadie. */
export function isTrustedSender(from: string, trusted: string | undefined): boolean {
  const address = senderAddress(from);
  return (trusted ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith("@") ? address.endsWith(entry) : address === entry));
}

/**
 * Id estable de la ingesta de un adjunto: Resend reintenta los webhooks y la
 * misma pieza no debe entrar dos veces.
 */
export function inboundIngestId(emailId: string, attachmentId: string | null): string {
  const hash = createHash("sha256").update(`${emailId}:${attachmentId ?? "body"}`).digest("hex");
  return [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join("-");
}
