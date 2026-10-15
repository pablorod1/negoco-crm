import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteIndexHistoryMonth,
  IndexHistoryUnavailableError,
  indexMonthProblem,
  saveIndexHistory,
} from "@/comparador/rates/index-history";
import { getComercializadora, listTenantRates } from "@/comparador/rates/repository";
import { RateIngestError } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess, type RatesContext } from "@/comparador/server/rates-route";

const Energy = z.object({ P1: z.number(), P2: z.number(), P3: z.number() });

const SaveSchema = z.object({
  comercializadora_id: z.string().min(1),
  /** null = de toda la comercializadora. */
  rate_id: z.string().min(1).nullable(),
  months: z.array(z.object({ month: z.string(), energy: Energy })).min(1).max(120),
});

const DeleteSchema = z.object({
  comercializadora_id: z.string().min(1),
  rate_id: z.string().min(1).nullable(),
  month: z.string(),
});

/** La comercializadora existe y la tarifa, si la hay, es suya. */
async function checkScope(context: RatesContext, comercializadoraId: string, rateId: string | null) {
  const supplier = await getComercializadora(context.client, comercializadoraId);
  if (!supplier) throw new RateIngestError("Comercializadora no encontrada", 404);
  if (rateId) {
    const rates = await listTenantRates(context.client, comercializadoraId);
    if (!rates.some(({ id }) => id === rateId)) throw new RateIngestError("La tarifa no es de esta comercializadora", 400);
  }
}

function historyError(scope: string, error: unknown) {
  if (error instanceof IndexHistoryUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return ratesError(scope, error);
}

/** Guarda meses del histórico del indexado (dirección y backoffice): cada mes sustituye al que hubiera. */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    const parsed = SaveSchema.safeParse(await request.json());
    if (!parsed.success) throw new RateIngestError("Datos no válidos");
    const { comercializadora_id: comercializadoraId, rate_id: rateId, months } = parsed.data;
    const problems = months.map(indexMonthProblem).filter((problem): problem is string => problem !== null);
    if (problems.length > 0) throw new RateIngestError(problems.slice(0, 3).join(" "));
    await checkScope(access.context, comercializadoraId, rateId);
    await saveIndexHistory(access.context.client, {
      comercializadoraId,
      rateId,
      months,
      source: "manual",
      userId: access.context.user.id,
    });
    return ok({ saved: months.length });
  } catch (error) {
    return historyError("save index history", error);
  }
}

/** Quita un mes del histórico. */
export async function DELETE(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    const parsed = DeleteSchema.safeParse(await request.json());
    if (!parsed.success || !/^\d{4}-\d{2}$/.test(parsed.data.month)) throw new RateIngestError("Datos no válidos");
    await checkScope(access.context, parsed.data.comercializadora_id, parsed.data.rate_id);
    await deleteIndexHistoryMonth(access.context.client, {
      comercializadoraId: parsed.data.comercializadora_id,
      rateId: parsed.data.rate_id,
      month: parsed.data.month,
    });
    return ok({ month: parsed.data.month });
  } catch (error) {
    return historyError("delete index history month", error);
  }
}
