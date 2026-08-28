import type { AbarcaComisiones } from "@/comparativas/types/abarca.types";

/**
 * Comisiones que Abarca manda con el estudio, leídas del payload guardado.
 *
 * Viven en `abarca_estudios.raw_payload` igual que `apolo_sips` y el estado de
 * los documentos: así se capturan sin migración mientras se decide cómo
 * volcarlas a `comparativas.comision_*` (falta resolver si van al slot fijo o
 * al indexado). La comisión del comercial se sigue calculando con nuestras
 * reglas por comercializadora; `base` queda guardada solo como referencia.
 *
 * Las dos vienen en euros, la misma unidad que usa el CRM.
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
