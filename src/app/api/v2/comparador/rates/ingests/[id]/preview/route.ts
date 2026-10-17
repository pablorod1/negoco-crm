import { NextRequest } from "next/server";
import { RateIngestError } from "@/comparador/rates/service";
import { DecisionsSchema, previewIngest } from "@/comparador/server/ingest-review";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** Revisión recalculada con las filas que el revisor excluye o completa. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const parsed = DecisionsSchema.safeParse(await request.json());
    if (!parsed.success) throw new RateIngestError("Decisiones no válidas");
    return ok(await previewIngest(access.context.client, id, parsed.data));
  } catch (error) {
    return ratesError("preview ingest", error);
  }
}
