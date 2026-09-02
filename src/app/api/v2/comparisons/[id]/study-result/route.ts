import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import {
  authorizeStudyResult, confirmStudyResult, getStudyResult,
  StudyResultDecisionSchema, StudyResultError,
} from "@/comparativas/server/study-result";

const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const QuerySchema = z.strictObject({ plan: z.enum(["fijo", "indexado"]).optional() });
type Context = { params: Promise<{ id: string }> };
function errorResponse(error: unknown) {
  if (error instanceof StudyResultError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error("[study-result] request failed", error);
  return NextResponse.json({ success: false, error: "No se pudo procesar el estudio con IA" }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await validateUserSession(request);
    if (!auth.success || !auth.user) return NextResponse.json({ success: false, error: "Sesión no válida" }, { status: 401 });
    const id = IdSchema.safeParse((await params).id);
    const query = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!id.success || !query.success) throw new StudyResultError(400, "Solicitud del estudio con IA no válida");
    const db = getTursoClient(request);
    if (!db) throw new Error("Database unavailable");
    // A read snapshot keeps permission, proposal and its revision consistent.
    const tx = await db.transaction("read");
    try {
      const response = await getStudyResult(tx, id.data, auth.user.id, query.data.plan);
      await tx.commit();
      return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally { tx.close(); }
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await validateUserSession(request);
    if (!auth.success || !auth.user) return NextResponse.json({ success: false, error: "Sesión no válida" }, { status: 401 });
    const id = IdSchema.safeParse((await params).id);
    let body: unknown;
    try { body = await request.json(); } catch { throw new StudyResultError(400, "Solicitud del estudio con IA no válida"); }
    const decision = StudyResultDecisionSchema.safeParse(body);
    if (!id.success || !decision.success) throw new StudyResultError(400, "Decisión del estudio con IA no válida");
    const db = getTursoClient(request);
    if (!db) throw new Error("Database unavailable");
    await authorizeStudyResult(db, id.data, auth.user.id);
    const tx = await db.transaction("write");
    try {
      const response = await confirmStudyResult(tx, id.data, auth.user.id, decision.data);
      await tx.commit();
      return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally { tx.close(); }
  } catch (error) { return errorResponse(error); }
}
