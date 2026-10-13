import { NextRequest, NextResponse } from "next/server";
import { isCatalogAdmin } from "@/comparador/access";
import { RateIngestError } from "@/comparador/rates/service";
import { UnsupportedDocumentError } from "@/comparador/rates/document";
import { RateDocumentTooLargeError } from "@/comparador/rates/extract";
import { SheetRecipeUnavailableError } from "@/comparador/rates/sheets/read";
import { requireNegocoStudiesAccess, type NegocoStudiesContext } from "./guard";

export interface RatesContext extends NegocoStudiesContext {
  canManage: boolean;
  canManageCatalog: boolean;
}

type RatesGuardResult =
  | { ok: true; context: RatesContext }
  | { ok: false; response: NextResponse };

/**
 * Guarda de las rutas de tarifas: la del comparador y ser de dirección o
 * backoffice, también para ver (los comerciales no ven precios de compra ni
 * comisiones). Dar de alta en el catálogo a mano exige además ser de Negoco.
 */
export async function requireRatesAccess(request: NextRequest): Promise<RatesGuardResult> {
  const access = await requireNegocoStudiesAccess(request);
  if (!access.ok) return access;

  const { role, email } = access.context.user;
  const canManage = role === "admin" || role === "1";
  if (!canManage) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solo dirección y backoffice ven y gestionan las tarifas" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: { ...access.context, canManage, canManageCatalog: isCatalogAdmin(email) },
  };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    { success: true, data },
    { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } },
  );
}

/** Errores esperados con su código; el resto, 500 sin detalles. */
export function ratesError(scope: string, error: unknown) {
  if (error instanceof RateIngestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (
    error instanceof UnsupportedDocumentError ||
    error instanceof RateDocumentTooLargeError ||
    error instanceof SheetRecipeUnavailableError
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(`[comparador] ${scope} failed`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
