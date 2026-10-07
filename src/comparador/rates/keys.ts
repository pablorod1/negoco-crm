import type { RateConditions } from "./types";

/**
 * Clave de la tarifa de acceso y las condiciones de una fila. Dos filas de la
 * misma tarifa con la misma clave son la misma fila de precios.
 */
export function conditionsKey(
  row: RateConditions & {
    accessTariff: string;
    includesAncillaryServices: boolean;
    feeEnergyMinPerMwh: number | null;
  },
): string {
  return [
    row.accessTariff,
    // Quimera publica el mismo producto con y sin servicios de ajuste, y con
    // un límite de consumo distinto para cada fee.
    row.includesAncillaryServices ? "" : "sin-ssaa",
    row.feeEnergyMinPerMwh ?? "",
    row.level?.toLowerCase() ?? "",
    row.territory,
    row.channel ?? "",
    row.clientSegment?.toLowerCase() ?? "",
    row.minPowerKw ?? "",
    row.maxPowerKw ?? "",
    row.minAnnualKwh ?? "",
    row.maxAnnualKwh ?? "",
    row.supplyStartFrom ?? "",
    row.supplyStartTo ?? "",
    row.termMonths ?? "",
  ].join("|");
}
