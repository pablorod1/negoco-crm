import type { CommissionSegment } from "@/core/types";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

/** Convierte únicamente tarifas inequívocas. 1TD queda excluida expresamente. */
export function commissionSegmentFromTariff(
  tariff?: string | null,
  service?: string | null,
): CommissionSegment | null {
  const normalizedTariff = normalize(tariff ?? "").replace(/\s+/g, "");
  const normalizedService = normalize(service ?? "");

  if (normalizedTariff === "1TD" || normalizedTariff.includes("1.0TD")) return null;
  if (/^2(?:\.0)?TD$/.test(normalizedTariff)) return "luz_20td";
  if (/^(?:3(?:\.0)?TD|6(?:\.1)?TD)$/.test(normalizedTariff)) return "luz_pymes";
  if (/^RL[-_. ]?\d/.test(normalizedTariff)) return "gas";
  if (!normalizedTariff && normalizedService === "GAS") return "gas";
  return null;
}

export const COMMISSION_SEGMENTS: readonly CommissionSegment[] = [
  "luz_20td",
  "luz_pymes",
  "gas",
];

export const COMMISSION_SEGMENT_LABELS: Record<CommissionSegment, string> = {
  luz_20td: "2.0 TD",
  luz_pymes: "3.0TD/6.1TD",
  gas: "Gas",
};
