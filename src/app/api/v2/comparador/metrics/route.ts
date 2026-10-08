import { NextRequest, NextResponse } from "next/server";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import { canSeeAgencyCommission, studyError } from "@/comparador/server/study-route";
import { studyMetrics } from "@/comparador/study/metrics";

/** Meses que se enseñan, incluido el actual. */
const MONTHS = 6;

/** Uso del comparador en los últimos meses. Solo admin y backoffice. */
export async function GET(request: NextRequest) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    if (!canSeeAgencyCommission(access.context.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1))
      .toISOString()
      .slice(0, 10);
    const months = await studyMetrics(access.context.client, from);
    return NextResponse.json({ success: true, data: { months } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return studyError("study metrics", error);
  }
}
