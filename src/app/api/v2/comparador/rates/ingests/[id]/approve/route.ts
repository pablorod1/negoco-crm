import { NextRequest } from "next/server";
import { z } from "zod";
import { getTursoControlClient } from "@/core/libsql/client";
import { getIngest } from "@/comparador/rates/repository";
import { approveIngest, RateIngestError, todayInSpain } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

const ApprovalSchema = z.object({
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  excludedRowKeys: z.array(z.string()).default([]),
  regulatedPowerRowKeys: z.array(z.string()).default([]),
  partialUpdate: z.boolean().optional(),
  includeCommissions: z.boolean().default(true),
  notes: z.string().max(1000).nullable().optional(),
});

/**
 * Aprueba una ingesta: guarda la versión de precios (activa o programada) y
 * las comisiones. Los productos nuevos en el catálogo solo los da de alta Negoco.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { id } = await params;
    const parsed = ApprovalSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new RateIngestError("Indica la fecha de entrada en vigor (AAAA-MM-DD).");
    }

    const { client, user, canManageCatalog } = access.context;
    const ingest = await getIngest(client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);

    const result = await approveIngest({
      client,
      control: getTursoControlClient(),
      ingest,
      input: parsed.data,
      user,
      isCatalogAdmin: canManageCatalog,
      today: todayInSpain(),
    });
    return ok(result);
  } catch (error) {
    return ratesError("approve ingest", error);
  }
}
