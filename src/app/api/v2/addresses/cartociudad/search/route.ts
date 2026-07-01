import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SearchSchema = z.object({
  q: z.string().trim().min(3),
  postal_code: z.string().trim().optional().nullable(),
  province: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  limit: z.coerce.number().min(1).max(10).optional().default(6),
});

const CARTOCIUDAD_CANDIDATES_URL =
  "https://www.cartociudad.es/geocoder/api/geocoder/candidates";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCandidate = (candidate: Record<string, unknown>) => {
  const tipVia = typeof candidate.tip_via === "string" ? candidate.tip_via : "";
  const escapedTipVia = escapeRegExp(tipVia);
  const portalNumber =
    typeof candidate.portalNumber === "string"
      ? candidate.portalNumber
      : typeof candidate.portalNumber === "number"
        ? String(candidate.portalNumber)
        : "";
  const extension =
    typeof candidate.extension === "string" ? candidate.extension : "";
  const escapedPortal = escapeRegExp(portalNumber);
  const escapedExtension = escapeRegExp(extension);

  return {
    id: String(candidate.id || candidate.address || crypto.randomUUID()),
    type: String(candidate.type || ""),
    label: String(candidate.address || ""),
    tipo_via_cnmc: tipVia,
    calle: String(candidate.address || "")
      .replace(new RegExp(`^${escapedTipVia}\\s+`, "i"), "")
      .replace(new RegExp(`\\s+${escapedPortal}${escapedExtension}$`, "i"), "")
      .trim(),
    numero_finca: [portalNumber, extension].filter(Boolean).join(""),
    postal_code: String(candidate.postalCode || ""),
    city: String(candidate.muni || candidate.poblacion || ""),
    province: String(candidate.province || ""),
    lat: candidate.lat == null ? null : Number(candidate.lat),
    lng: candidate.lng == null ? null : Number(candidate.lng),
    raw: candidate,
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = SearchSchema.safeParse({
      q: searchParams.get("q"),
      postal_code: searchParams.get("postal_code"),
      province: searchParams.get("province"),
      city: searchParams.get("city"),
      limit: searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Introduce al menos 3 caracteres para buscar dirección",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const query = new URL(CARTOCIUDAD_CANDIDATES_URL);
    query.searchParams.set("q", parsed.data.q);
    query.searchParams.set("limit", String(parsed.data.limit));
    query.searchParams.set("countrycodes", "es");
    if (parsed.data.postal_code) {
      query.searchParams.set("cod_postal_filter", parsed.data.postal_code);
    }
    if (parsed.data.province) {
      query.searchParams.set("provincia_filter", parsed.data.province);
    }
    if (parsed.data.city) {
      query.searchParams.set("municipio_filter", parsed.data.city);
    }

    const response = await fetch(query, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `CartoCiudad ha devuelto ${response.status}`,
        },
        { status: 502 },
      );
    }

    const payload = await response.json();
    const candidates = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.candidates)
        ? payload.candidates
        : [];

    return NextResponse.json({
      success: true,
      data: candidates
        .filter((candidate: unknown): candidate is Record<string, unknown> =>
          Boolean(candidate && typeof candidate === "object"),
        )
        .map(normalizeCandidate),
    });
  } catch (error) {
    console.error("CartoCiudad search error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al buscar dirección en CartoCiudad",
      },
      { status: 500 },
    );
  }
}
