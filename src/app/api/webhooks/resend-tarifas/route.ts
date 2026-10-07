import { after, NextRequest, NextResponse } from "next/server";
import { getTursoClientByTenant } from "@/core/libsql/client";
import { getTenantModules } from "@/core/modules/server";
import {
  inboundIngestId,
  isTrustedSender,
  selectAttachments,
  tenantFromRecipients,
  verifySvixSignature,
  type InboundAttachment,
} from "@/comparador/rates/inbound";
import { createIngest, getIngest } from "@/comparador/rates/repository";
import { processIngest } from "@/comparador/rates/service";
import { MAX_RATE_FILE_BYTES, storeIngestFile } from "@/comparador/rates/storage";

export const maxDuration = 300;

const RESEND_API = "https://api.resend.com";

interface ReceivedEvent {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    received_for?: string[];
    subject?: string;
  };
}

async function resend<T>(path: string): Promise<T> {
  const response = await fetch(`${RESEND_API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Resend ${path}: ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Webhook `email.received` de Resend. Cada adjunto que pueda ser un anexo
 * crea una ingesta; un correo sin adjuntos útiles crea una con su texto. Solo
 * se procesan solas las de remitentes de confianza: el resto espera a que
 * alguien pulse «Procesar», para no gastar crédito con correo basura.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  const domain = process.env.COMPARADOR_INBOUND_DOMAIN;
  if (!secret || !domain || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Buzón no configurado" }, { status: 503 });
  }

  const body = await request.text();
  const valid = verifySvixSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signatureHeader: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return NextResponse.json({ error: "Firma no válida" }, { status: 401 });

  try {
    const event = JSON.parse(body) as ReceivedEvent;
    if (event.type !== "email.received") return NextResponse.json({ ignored: true });

    const { email_id: emailId, from, subject } = event.data;
    const tenantSlug = tenantFromRecipients(
      [...(event.data.to ?? []), ...(event.data.received_for ?? [])],
      domain,
    );
    // Un destinatario desconocido no es un error de Resend: se acepta y se ignora.
    if (!tenantSlug) return NextResponse.json({ ignored: "destinatario" });
    const modules = await getTenantModules(tenantSlug);
    if (!modules.negoco_studies) return NextResponse.json({ ignored: "módulo" });

    let client;
    try {
      client = getTursoClientByTenant(tenantSlug);
    } catch {
      return NextResponse.json({ ignored: "tenant" });
    }

    const [email, attachments] = await Promise.all([
      resend<{ text?: string | null; html?: string | null }>(`/emails/receiving/${emailId}`),
      resend<{ data: InboundAttachment[] }>(`/emails/receiving/${emailId}/attachments?limit=100`),
    ]);
    const useful = selectAttachments(attachments.data, MAX_RATE_FILE_BYTES);

    const created: string[] = [];
    for (const attachment of useful.length ? useful : [null]) {
      const id = inboundIngestId(emailId, attachment?.id ?? null);
      if (await getIngest(client, id)) continue;

      const files = [];
      if (attachment?.download_url) {
        const download = await fetch(attachment.download_url);
        if (!download.ok) throw new Error(`Adjunto ${attachment.filename}: ${download.status}`);
        files.push(
          await storeIngestFile({
            tenantSlug,
            ingestId: id,
            name: attachment.filename,
            mime: attachment.content_type,
            data: new Uint8Array(await download.arrayBuffer()),
          }),
        );
      }
      const text = email.text?.trim() || email.html || "";
      if (!attachment && !text) continue;

      await createIngest(client, {
        id,
        channel: "email",
        comercializadoraId: null,
        files,
        bodyText: attachment ? null : text.slice(0, 200_000),
        emailFrom: from,
        emailSubject: subject ?? null,
        createdBy: null,
      });
      created.push(id);
    }

    if (created.length && isTrustedSender(from, process.env.COMPARADOR_INBOUND_TRUSTED_SENDERS)) {
      after(async () => {
        for (const id of created) {
          const ingest = await getIngest(client, id);
          if (!ingest) continue;
          await processIngest({ client, ingest, tenantSlug, userId: null }).catch((error) =>
            console.error("[comparador] inbound processing failed", id, error),
          );
        }
      });
    }

    return NextResponse.json({ created: created.length });
  } catch (error) {
    // Un 500 hace que Resend reintente; las ingestas ya creadas no se repiten.
    console.error("[comparador] inbound email failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
