import { NextRequest } from "next/server";
import { z } from "zod";
import { getTursoControlClient } from "@/core/libsql/client";
import { getIngest } from "@/comparador/rates/repository";
import { buildReview, RateIngestError, todayInSpain } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

const DecisionsSchema = z.object({
  excludedRowKeys: z.array(z.string()).default([]),
  regulatedPowerRowKeys: z.array(z.string()).default([]),
  manualPower: z
    .record(z.string(), z.object({ p1: z.number().positive().max(500), p2: z.number().nonnegative().max(500) }))
    .default({}),
  partialUpdate: z.boolean().optional(),
});

/** Revisión recalculada con las filas que el revisor excluye o completa. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { id } = await params;
    const parsed = DecisionsSchema.safeParse(await request.json());
    if (!parsed.success) throw new RateIngestError("Decisiones no válidas");

    const ingest = await getIngest(access.context.client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);

    const built = await buildReview({
      client: access.context.client,
      control: getTursoControlClient(),
      ingest,
      today: todayInSpain(),
      decisions: parsed.data,
    });
    return ok({ review: built?.review ?? null });
  } catch (error) {
    return ratesError("preview ingest", error);
  }
}
