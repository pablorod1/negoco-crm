import { NextRequest } from "next/server";
import { z } from "zod";
import { getTursoControlClient } from "@/core/libsql/client";
import { getComercializadora, getIngest } from "@/comparador/rates/repository";
import { buildReview, RateIngestError, todayInSpain } from "@/comparador/rates/service";
import { ingestFileUrl } from "@/comparador/rates/storage";
import { summarizeIngest } from "@/comparador/rates/views";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

type Params = { params: Promise<{ id: string }> };

/** Una ingesta con su revisión frente a la versión activa de hoy. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const access = await requireRatesAccess(request, { manage: false });
    if (!access.ok) return access.response;
    const { id } = await params;

    const ingest = await getIngest(access.context.client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);

    const built = await buildReview({
      client: access.context.client,
      control: getTursoControlClient(),
      ingest,
      today: todayInSpain(),
    });
    return ok({
      ingest: summarizeIngest(ingest),
      originalUrl: ingest.files[0] ? await ingestFileUrl(ingest.files[0]) : null,
      bodyText: ingest.files[0] ? null : ingest.bodyText,
      issues: ingest.validation,
      review: built?.review ?? null,
      canManage: access.context.canManage,
      canManageCatalog: access.context.canManageCatalog,
    });
  } catch (error) {
    return ratesError("get ingest", error);
  }
}

const PatchSchema = z.object({ comercializadora_id: z.string().min(1) });

/**
 * Asigna la comercializadora a una ingesta que llegó sin ella (un correo que
 * no la nombra). Después hay que procesarla de nuevo.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { id } = await params;
    const parsed = PatchSchema.safeParse(await request.json());
    if (!parsed.success) throw new RateIngestError("Falta comercializadora_id");

    const { client } = access.context;
    const ingest = await getIngest(client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);
    if (["approved", "rejected", "processing"].includes(ingest.status)) {
      throw new RateIngestError("Esta ingesta ya está decidida o se está procesando.", 409);
    }
    if (!(await getComercializadora(client, parsed.data.comercializadora_id))) {
      throw new RateIngestError("Comercializadora no encontrada", 404);
    }

    await client.execute({
      sql: "UPDATE rate_ingests SET comercializadora_id = ? WHERE id = ?",
      args: [parsed.data.comercializadora_id, id],
    });
    return ok({ id });
  } catch (error) {
    return ratesError("assign ingest supplier", error);
  }
}
