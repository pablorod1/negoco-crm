import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClientByTenant } from "@/core/libsql/client";
import { getTenantModules } from "@/core/modules/server";
import { RateIngestError } from "@/comparador/rates/service";
import { reviewerUserId, verifyBackofficeRequest } from "@/comparador/server/backoffice-auth";
import {
  ApprovalSchema,
  approveIngestById,
  assignIngestSupplier,
  DecisionsSchema,
  getIngestDetail,
  listActiveSuppliers,
  previewIngest,
  processIngestById,
  rejectIngestById,
} from "@/comparador/server/ingest-review";
import { ok, ratesError } from "@/comparador/server/rates-route";
import { presentReview } from "@/comparador/server/review-presentation";

/** Volver a leer un Excel largo tarda hasta un par de minutos. */
export const maxDuration = 300;

type Params = { params: Promise<{ tenant: string; id: string }> };

/**
 * Revisión de anexos desde el backoffice de Negoco: la cola de todos los
 * tenants vive allí y las acciones se hacen aquí, con la misma lógica que el
 * CRM. Solo por api.* (src/proxy.ts) y con la petición firmada
 * (backoffice-auth.ts).
 */
async function access(request: NextRequest, params: Params["params"], body: string) {
  const verified = verifyBackofficeRequest(request, body);
  if (!verified) return { error: NextResponse.json({ error: "Firma no válida" }, { status: 401 }) } as const;
  const { tenant, id } = await params;
  if (!/^[a-z0-9-]{2,40}$/.test(tenant) || !(await getTenantModules(tenant)).negoco_studies) {
    return { error: NextResponse.json({ error: "Tenant sin comparador" }, { status: 404 }) } as const;
  }
  return { client: getTursoClientByTenant(tenant), tenant, id, reviewer: verified.reviewer } as const;
}

/** La ingesta con su revisión, y las comercializadoras del tenant para asignarle una. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const context = await access(request, params, "");
    if ("error" in context) return context.error;
    const [detail, suppliers] = await Promise.all([
      getIngestDetail(context.client, context.id),
      listActiveSuppliers(context.client),
    ]);
    return ok({ ...detail, review: presentReview(detail.review), suppliers });
  } catch (error) {
    return ratesError("backoffice get ingest", error);
  }
}

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), decisions: DecisionsSchema }),
  z.object({ action: z.literal("approve"), approval: ApprovalSchema }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("process"), comercializadoraId: z.string().min(1).optional() }),
]);

/** Previsualizar con decisiones, aprobar, descartar o (asignar y) volver a leer. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const body = await request.text();
    const context = await access(request, params, body);
    if ("error" in context) return context.error;
    let json: unknown;
    try {
      json = JSON.parse(body || "{}");
    } catch {
      throw new RateIngestError("Cuerpo no válido");
    }
    const parsed = ActionSchema.safeParse(json);
    if (!parsed.success) throw new RateIngestError("Acción no válida");

    const { client, tenant, id } = context;
    const userId = reviewerUserId(context.reviewer);
    switch (parsed.data.action) {
      case "preview":
        return ok({ review: presentReview((await previewIngest(client, id, parsed.data.decisions)).review) });
      case "approve":
        return ok(await approveIngestById({ client, id, input: parsed.data.approval, userId, tenantSlug: tenant, request }));
      case "reject":
        return ok(await rejectIngestById({ client, id, userId, tenantSlug: tenant, request }));
      case "process":
        if (parsed.data.comercializadoraId) await assignIngestSupplier(client, id, parsed.data.comercializadoraId);
        return ok(await processIngestById({ client, id, userId, tenantSlug: tenant, request }));
    }
  } catch (error) {
    return ratesError("backoffice ingest action", error);
  }
}
