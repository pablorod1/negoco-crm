/**
 * Importes regulados con su vigencia. Solo se incluyen valores comprobados en
 * facturas reales; una fecha fuera de los tramos conocidos es un error, no un
 * valor por defecto.
 */

interface ValidityRange<T> {
  /** Primer día de vigencia (YYYY-MM-DD). */
  from: string;
  /** Primer día en que deja de aplicarse (YYYY-MM-DD). Sin valor: vigente. */
  until?: string;
  value: T;
  source: string;
}

export interface RegulatedParams {
  /** Impuesto especial sobre la electricidad, en tanto por uno. */
  electricityTaxRate: number;
  /** IVA en tanto por uno. */
  vatRate: number;
  /** Financiación del bono social, en €/día. */
  socialBonusPerDay: number;
}

const ELECTRICITY_TAX_RATE: readonly ValidityRange<number>[] = [
  {
    from: "2026-01-01",
    value: 0.0511269632,
    source: "Facturas de Beenergy de 2026 (Endesa, Iberdrola, Naturgy)",
  },
];

const VAT_RATE: readonly ValidityRange<number>[] = [
  {
    from: "2026-01-01",
    value: 0.21,
    source: "Facturas de Beenergy de 2026 (Endesa, Iberdrola, Naturgy)",
  },
];

const SOCIAL_BONUS_PER_DAY: readonly ValidityRange<number>[] = [
  {
    from: "2026-01-01",
    until: "2026-07-01",
    value: 0.019121,
    source: "Facturas de Iberdrola y Repsol de junio de 2026; fecha de inicio por confirmar",
  },
  {
    // Repsol factura «24.06–30.06» al precio anterior y «01.07–26.07» al nuevo.
    from: "2026-07-01",
    value: 0.024688,
    source: "Facturas de Beenergy de julio a septiembre de 2026",
  },
];

export class RegulatedParamsUnavailableError extends Error {
  constructor(name: string, date: string) {
    super(`No hay valor de ${name} vigente el ${date}`);
    this.name = "RegulatedParamsUnavailableError";
  }
}

function valueOn<T>(
  ranges: readonly ValidityRange<T>[],
  date: string,
  name: string,
): T {
  const range = ranges.find(
    ({ from, until }) => from <= date && (until === undefined || date < until),
  );
  if (!range) throw new RegulatedParamsUnavailableError(name, date);
  return range.value;
}

/** Parámetros regulados vigentes en una fecha (YYYY-MM-DD). */
export function getRegulatedParams(date: string): RegulatedParams {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError(`Fecha no válida: ${date}`);
  }

  return {
    electricityTaxRate: valueOn(ELECTRICITY_TAX_RATE, date, "IEE"),
    vatRate: valueOn(VAT_RATE, date, "IVA"),
    socialBonusPerDay: valueOn(SOCIAL_BONUS_PER_DAY, date, "bono social"),
  };
}
