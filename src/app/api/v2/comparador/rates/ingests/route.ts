import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import {
  createIngest,
  getComercializadora,
  listIngests,
} from "@/comparador/rates/repository";
import { RateIngestError } from "@/comparador/rates/service";
import { MAX_RATE_FILE_BYTES, storeIngestFile } from "@/comparador/rates/storage";
import { summarizeIngest } from "@/comparador/rates/views";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** Ingestas recientes, de una comercializadora o de todas. */
export async function GET(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request, { manage: false });
    if (!access.ok) return access.response;

    const ingests = await listIngests(access.context.client, {
      comercializadoraId: request.nextUrl.searchParams.get("comercializadora_id"),
      limit: 50,
    });
    return ok(ingests.map(summarizeIngest));
  } catch (error) {
    return ratesError("list ingests", error);
  }
}

/**
 * Subida manual de un anexo: un archivo (PDF, Excel, CSV o imagen) o texto
 * pegado del correo. Solo crea la ingesta; se procesa con `…/process`.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { client, tenantSlug, user } = access.context;

    const form = await request.formData();
    const comercializadoraId = String(form.get("comercializadora_id") ?? "") || null;
    const file = form.get("file");
    const text = String(form.get("text") ?? "").trim();

    if (comercializadoraId && !(await getComercializadora(client, comercializadoraId))) {
      throw new RateIngestError("Comercializadora no encontrada", 404);
    }
    if (!(file instanceof File) && !text) {
      throw new RateIngestError("Sube un archivo o pega el texto del correo.");
    }

    const ingestId = randomUUID();
    const files = [];
    if (file instanceof File) {
      if (file.size === 0 || file.size > MAX_RATE_FILE_BYTES) {
        throw new RateIngestError("El archivo está vacío o pasa de 20 MB.");
      }
      files.push(
        await storeIngestFile({
          tenantSlug,
          ingestId,
          name: file.name,
          mime: file.type || "application/octet-stream",
          data: new Uint8Array(await file.arrayBuffer()),
        }),
      );
    }

    await createIngest(client, {
      id: ingestId,
      channel: "upload",
      comercializadoraId,
      files,
      bodyText: files.length ? null : text.slice(0, 200_000),
      createdBy: user.id,
    });
    return ok({ id: ingestId }, { status: 201 });
  } catch (error) {
    return ratesError("create ingest", error);
  }
}
