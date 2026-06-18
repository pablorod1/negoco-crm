import { NextResponse } from "next/server";
import { getTursoClientByTenant } from "@/core/libsql/client";
import {
  getPublicRequestUrl,
  ImaginaContractChangeWebhookSchema,
  markWebhookProcessed,
  processImaginaContractChangeWebhook,
  readImaginaEnergiaConfig,
  recordWebhookEvent,
  tenantFromHost,
  verifyImaginaSignature,
} from "@/core/integrations/imagina-energia";

export async function POST(request: Request) {
  const tenant = tenantFromHost(request.headers.get("host"));
  if (!tenant) {
    return NextResponse.json(
      { success: false, error: "INVALID_TENANT_HOST" },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const config = readImaginaEnergiaConfig();
  const publicUrl = getPublicRequestUrl(request);
  const signature = verifyImaginaSignature({
    payload,
    headers: request.headers,
    publicUrl,
    seedKey: config.callbackSeedKey,
  });

  if (!signature.valid) {
    return NextResponse.json(
      { success: false, error: "INVALID_SIGNATURE", reason: signature.reason },
      { status: 401 },
    );
  }

  const parsed = ImaginaContractChangeWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "VALIDATION_ERROR",
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const db = getTursoClientByTenant(tenant);
  const event = await recordWebhookEvent(db, {
    eventType: "contratos",
    notificationId: parsed.data._metadata?.notification_id,
    imaginaContractId: parsed.data.contrato?.id,
    payload: parsed.data,
    publicUrl,
  });

  if (!event.inserted) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  const result = await processImaginaContractChangeWebhook(
    { db, tenant },
    parsed.data,
  );
  if (!result.success) {
    return NextResponse.json(result, { status: result.status || 500 });
  }

  await markWebhookProcessed(db, event.id);
  return NextResponse.json({ success: true });
}
