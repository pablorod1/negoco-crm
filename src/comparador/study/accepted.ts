/**
 * Qué propuestas puede aceptar un cliente a la vez al completar el estudio
 * (Beenergy, 2026-10-17): una fija, una indexada, una de cada, o una
 * comparativa múltiple de 2 o 3 fijas. Es lo que cabe en la comparativa del
 * CRM: un plan fijo y uno indexado, cada uno con su comisión.
 */

export type AcceptedPricing = "fixed" | "indexed";

export const MAX_ACCEPTED = 3;

export const ACCEPTED_RULE = "Una fija, una indexada, una de cada o de 2 a 3 fijas.";

/** Por qué no vale esa combinación; null si vale. */
export function acceptedProposalsError(pricings: readonly AcceptedPricing[]): string | null {
  if (pricings.length === 0) return "Elige la propuesta que acepta el cliente.";
  const indexed = pricings.filter((pricing) => pricing === "indexed").length;
  const fixed = pricings.length - indexed;
  if (indexed > 1) return `Solo una indexada. ${ACCEPTED_RULE}`;
  if (indexed === 1 && fixed > 1) return `Con una indexada, solo una fija. ${ACCEPTED_RULE}`;
  if (fixed > MAX_ACCEPTED) return `Como mucho ${MAX_ACCEPTED} fijas. ${ACCEPTED_RULE}`;
  return null;
}
