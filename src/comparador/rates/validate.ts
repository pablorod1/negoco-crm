import { conditionsKey } from "./keys";
import { appearsInText, numbersInText } from "./normalize";
import type { ProposedRate } from "./types";

export type RateIssueSeverity = "blocking" | "warning" | "info";

export interface RateIssue {
  severity: RateIssueSeverity;
  code:
    | "no_rates"
    | "out_of_scope_row"
    | "missing_energy"
    | "energy_out_of_range"
    | "missing_power"
    | "power_out_of_range"
    | "not_in_source"
    | "duplicate_row"
    | "energy_order"
    | "broken_cells"
    | "missing_valid_from"
    | "unverifiable_source"
    | "big_change"
    | "missing_rate"
    | "old_document"
    | "partial_read";
  message: string;
  /** Fila de `proposed` a la que se refiere, si es de una fila. */
  row?: number;
  /** Clave estable de esa fila (producto y condiciones), para excluirla al aprobar. */
  rowKey?: string;
}

/** Tarifas que compara la v1. */
export const SUPPORTED_ACCESS_TARIFFS = ["2.0TD"] as const;

// Rangos plausibles en las unidades del motor. La potencia de valle de la
// 2.0TD regulada ronda 0,002 €/kW·día; la de punta más cara, 0,2.
const ENERGY_RANGE = { min: 0.02, max: 0.6 };
const POWER_RANGE = { min: 0.0005, max: 0.5 };

/** Clave de una fila propuesta: producto, tarifa y todas sus condiciones. */
export function rowKey(row: ProposedRate): string {
  return `${row.productKey}|${conditionsKey(row)}`;
}

/** La fila entra en la v1: 2.0TD de precio fijo. */
export function isInScope(row: Pick<ProposedRate, "accessTariff" | "pricing">) {
  return (
    (SUPPORTED_ACCESS_TARIFFS as readonly string[]).includes(row.accessTariff) &&
    row.pricing === "fixed"
  );
}

function inRange(value: number, range: { min: number; max: number }) {
  return value >= range.min && value <= range.max;
}

/**
 * Comprueba las filas propuestas. Con el texto del documento, además, que
 * cada cifra copiada aparezca en él: es lo que convierte una cifra inventada o
 * mal leída en una revisión en vez de un precio equivocado.
 */
export function validateProposedRates(
  proposed: readonly ProposedRate[],
  {
    sourceText,
    partialUpdate,
    validFrom,
    readFromCells = false,
  }: {
    /** Texto del documento. `null` en imágenes y PDF escaneados. */
    sourceText: string | null;
    partialUpdate: boolean;
    validFrom: string | null;
    /**
     * Las cifras salen de las celdas de un Excel (plantilla), no las ha escrito
     * la IA: no hace falta buscarlas en el texto.
     */
    readFromCells?: boolean;
  },
): RateIssue[] {
  const issues: RateIssue[] = [];
  const numbers = sourceText ? numbersInText(sourceText) : null;
  const inScope = proposed.filter(isInScope);

  if (inScope.length === 0) {
    issues.push({
      severity: "blocking",
      code: "no_rates",
      message: "El documento no trae precios fijos de 2.0TD.",
    });
  }

  if (!numbers && !readFromCells) {
    issues.push({
      severity: "warning",
      code: "unverifiable_source",
      message:
        "El documento no tiene texto (imagen o PDF escaneado): hay que revisar cada precio contra el original.",
    });
  }

  if (sourceText && /#(REF|N\/A|VALUE|DIV\/0|NAME)!?/i.test(sourceText)) {
    issues.push({
      severity: "warning",
      code: "broken_cells",
      message:
        "La hoja tiene celdas con errores (#REF!, #N/A…). Comprueba que no afectan a la 2.0TD.",
    });
  }

  if (!validFrom) {
    issues.push({
      severity: "warning",
      code: "missing_valid_from",
      message: "El documento no indica desde cuándo valen los precios.",
    });
  }

  const seen = new Map<string, number>();
  proposed.forEach((row, index) => {
    if (!isInScope(row)) {
      issues.push({
        severity: "info",
        code: "out_of_scope_row",
        message: `${row.productName} (${row.accessTariff}, ${row.pricing}) no entra en la v1 y no se guarda.`,
        row: index,
        rowKey: rowKey(row),
      });
      return;
    }

    const key = rowKey(row);
    const previous = seen.get(key);
    if (previous !== undefined) {
      issues.push({
        severity: "blocking",
        code: "duplicate_row",
        message: `${row.productName} aparece dos veces con las mismas condiciones (nivel, territorio, bandas…).`,
        row: index,
        rowKey: rowKey(row),
      });
    }
    seen.set(key, index);

    if (!row.energy) {
      issues.push({
        severity: "blocking",
        code: "missing_energy",
        message: `${row.productName}: falta el precio de la energía de algún periodo.`,
        row: index,
        rowKey: rowKey(row),
      });
    } else {
      const values = [row.energy.P1, row.energy.P2, row.energy.P3];
      if (!values.every((value) => inRange(value, ENERGY_RANGE))) {
        issues.push({
          severity: "blocking",
          code: "energy_out_of_range",
          message: `${row.productName}: energía fuera de rango (${values.join(" / ")} €/kWh). ¿Unidad equivocada?`,
          row: index,
          rowKey: rowKey(row),
        });
      } else if (row.energy.P1 < row.energy.P2 || row.energy.P2 < row.energy.P3) {
        issues.push({
          severity: "warning",
          code: "energy_order",
          message: `${row.productName}: la energía no baja de punta a valle (${values.join(" / ")}).`,
          row: index,
          rowKey: rowKey(row),
        });
      }
    }

    if (row.powerMode === "fixed") {
      if (!row.power) {
        // En una actualización parcial se conserva la potencia de la versión activa.
        if (!partialUpdate) {
          issues.push({
            severity: "blocking",
            code: "missing_power",
            message: `${row.productName}: el documento no da la potencia. Indica si es la regulada («BOE»).`,
            row: index,
            rowKey: rowKey(row),
          });
        }
      } else if (
        !inRange(row.power.P1, POWER_RANGE) ||
        !inRange(row.power.P2, POWER_RANGE)
      ) {
        issues.push({
          severity: "blocking",
          code: "power_out_of_range",
          message: `${row.productName}: potencia fuera de rango (${row.power.P1} / ${row.power.P2} €/kW·día). ¿Unidad equivocada?`,
          row: index,
          rowKey: rowKey(row),
        });
      }
    }

    if (numbers) {
      const raw = row.sourceValues;
      const copied = [
        raw.energyP1,
        raw.energyP2,
        raw.energyP3,
        raw.powerP1,
        raw.powerP2,
        raw.powerMargin,
      ].filter((value): value is number => typeof value === "number" && value !== 0);
      const missing = copied.filter((value) => !appearsInText(value, numbers, sourceText));
      if (missing.length > 0) {
        issues.push({
          severity: "blocking",
          code: "not_in_source",
          message: `${row.productName}: ${missing.join(", ")} no aparece en el documento.`,
          row: index,
          rowKey: rowKey(row),
        });
      }
    }
  });

  return issues;
}

export function hasBlockingIssues(issues: readonly RateIssue[]): boolean {
  return issues.some(({ severity }) => severity === "blocking");
}
