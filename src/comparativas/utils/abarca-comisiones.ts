import type { AbarcaComisiones } from "@/comparativas/types/abarca.types";

/**
 * Comisiones que Abarca manda con el estudio, leídas del payload guardado.
 *
 * Oferta está expresada en euros y base en porcentaje. La aplicación y el
 * cálculo autorizados viven en el servicio de resultados del estudio.
 */
export function parseAbarcaComisiones(
  rawPayload: string,
): AbarcaComisiones | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  const oferta = toComision(candidate.comision_oferta);
  const base = toComision(candidate.comision_base);
  if (oferta === null && base === null) return null;

  return { base, oferta };
}

function toComision(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
