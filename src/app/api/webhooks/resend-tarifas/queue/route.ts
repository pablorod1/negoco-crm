import { after, NextRequest, NextResponse } from "next/server";
import {
  INBOUND_QUEUE_SIGNATURE_HEADER,
  runInboundQueue,
  verifyInboundQueue,
  type InboundQueue,
} from "@/comparador/server/inbound-queue";

export const maxDuration = 300;

/**
 * Sigue con los anexos de un correo del buzón (ver inbound-queue.ts). Solo la
 * llama el propio servidor, con la cola firmada con el secreto del webhook.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Buzón no configurado" }, { status: 503 });

  const body = await request.text();
  if (!verifyInboundQueue(body, request.headers.get(INBOUND_QUEUE_SIGNATURE_HEADER), secret)) {
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }

  const queue = JSON.parse(body) as InboundQueue;
  after(() => runInboundQueue(queue, request.url, secret));
  return NextResponse.json({ queued: queue.ids.length }, { status: 202 });
}
