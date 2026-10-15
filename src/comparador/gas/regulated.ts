/**
 * Lo regulado del gas natural: peajes de acceso (RL), impuesto sobre
 * hidrocarburos e IVA, y los peajes y cargos de cada año de gas. La TUR no se
 * calcula: Beenergy no quiere enseñarla (despierta la idea de pasarse al
 * regulado, que suele ser más barato).
 * Como en la luz, una fecha fuera de los tramos conocidos es un error, no un
 * valor por defecto.
 */

/** Peajes de acceso de gas de hogar y negocio que compara el comparador. */
export const GAS_ACCESS_TARIFFS = ["RL.1", "RL.2", "RL.3", "RL.4"] as const;
export type GasAccessTariff = (typeof GAS_ACCESS_TARIFFS)[number];

/** Consumo anual máximo de cada peaje (y de su TUR), en kWh; el mínimo es el máximo del anterior. */
export const GAS_TARIFF_MAX_KWH: Record<GasAccessTariff, number> = {
  "RL.1": 5_000,
  "RL.2": 15_000,
  "RL.3": 50_000,
  "RL.4": 300_000,
};

/** El peaje que corresponde a un consumo anual; null por encima de RL.4. */
export function gasTariffForKwh(annualKwh: number): GasAccessTariff | null {
  return GAS_ACCESS_TARIFFS.find((tariff) => annualKwh <= GAS_TARIFF_MAX_KWH[tariff]) ?? null;
}

/**
 * «RL.1», «RL1», «RL01», «RL-2», «TUR.2», «TUR 3» y los códigos del SIPS
 * («R1» a «R4», tabla GAS_TIPO_PEAJE de la CNMC) → «RL.n»; null si no es uno
 * de los cuatro. Los de planta satélite («S1», RLPS) llevan otros peajes, y
 * los anteriores a 2021 («3.1» a «3.4») tenían otras bandas: null.
 */
export function normalizeGasTariff(raw: string | null | undefined): GasAccessTariff | null {
  const text = (raw ?? "").toUpperCase().replace(/\s+/g, "");
  const match = /^(?:RL|TUR|R)[-_.]?0?([1-4])$/.exec(text);
  return match ? (`RL.${match[1]}` as GasAccessTariff) : null;
}

interface ValidityRange<T> {
  /** Primer día de vigencia (YYYY-MM-DD). */
  from: string;
  /** Primer día en que deja de aplicarse. Sin valor: vigente. */
  until?: string;
  value: T;
  source: string;
}

export interface GasRegulatedParams {
  /** Impuesto especial sobre hidrocarburos del gas natural, en €/kWh. */
  hydrocarbonTaxPerKwh: number;
  /** IVA en tanto por uno. */
  vatRate: number;
}

const HYDROCARBON_TAX_PER_KWH: readonly ValidityRange<number>[] = [
  {
    // 0,65 €/GJ (× 3,6 / 1000 = 0,00234 €/kWh). En 2026 bajó a 0,00108 por
    // el RDL 7/2026 y volvió por tramos (RDL 18/2026) hasta septiembre.
    from: "2026-10-01",
    value: 0.00234,
    source: "Ley 38/1992, art. 50, epígrafe 1.10; tipo general tras la desescalada del RDL 18/2026",
  },
];

const VAT_RATE: readonly ValidityRange<number>[] = [
  {
    // El RDL 25/2026 permite el 10 % en noviembre y diciembre si el IPC del
    // gas sube más de un 15 %: entonces se toma el de la factura del cliente.
    from: "2026-10-01",
    value: 0.21,
    source: "Tipo general; RDL 25/2026",
  },
];

export class GasRegulatedUnavailableError extends Error {
  constructor(name: string, date: string) {
    super(`No hay valor de ${name} del gas vigente el ${date}`);
    this.name = "GasRegulatedUnavailableError";
  }
}

function valueOn<T>(ranges: readonly ValidityRange<T>[], date: string, name: string): T {
  const range = ranges.find(({ from, until }) => from <= date && (until === undefined || date < until));
  if (!range) throw new GasRegulatedUnavailableError(name, date);
  return range.value;
}

/** Impuesto de hidrocarburos e IVA del gas vigentes en una fecha (YYYY-MM-DD). */
export function getGasRegulatedParams(date: string): GasRegulatedParams {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError(`Fecha no válida: ${date}`);
  return {
    hydrocarbonTaxPerKwh: valueOn(HYDROCARBON_TAX_PER_KWH, date, "impuesto de hidrocarburos"),
    vatRate: valueOn(VAT_RATE, date, "IVA"),
  };
}

/** Luz o gas según la tarifa de acceso de una fila de precios o de una comisión. */
export function energyOfTariff(accessTariff: string | null | undefined): "electricity" | "gas" {
  return normalizeGasTariff(accessTariff) ? "gas" : "electricity";
}

/**
 * Peajes y cargos del gas sin telemedida (RL.1 a RL.4): lo que se suma a un
 * precio que no los lleva. Término fijo = red local + salida de red troncal
 * + otros costes de regasificación + cargo fijo; variable = red local.
 */
export interface GasTolls {
  /** €/cliente y año. */
  fixedPerYear: number;
  /** €/kWh. */
  energyPerKwh: number;
}

const GAS_TOLLS: readonly ValidityRange<Record<GasAccessTariff, GasTolls>>[] = [
  {
    // Año de gas 2026. RL.1: 23,895429 + 1,518478 + 1,063439 + 0,29.
    from: "2025-10-01",
    until: "2026-10-01",
    value: {
      "RL.1": { fixedPerYear: 26.767346, energyPerKwh: 0.01524 },
      "RL.2": { fixedPerYear: 69.712628, energyPerKwh: 0.013172 },
      "RL.3": { fixedPerYear: 184.266688, energyPerKwh: 0.009782 },
      "RL.4": { fixedPerYear: 492.278185, energyPerKwh: 0.012887 },
    },
    source: "Peajes: Resolución CNMC de 27/05/2025 (BOE-A-2025-11064). Cargos: Orden TED/1062/2025 (BOE-A-2025-19341)",
  },
  {
    // Año de gas 2027: los mismos peajes, sin los otros costes de
    // regasificación. Coincide al céntimo con el término fijo de Axpo (octubre de 2026).
    from: "2026-10-01",
    until: "2027-10-01",
    value: {
      "RL.1": { fixedPerYear: 25.703907, energyPerKwh: 0.01524 },
      "RL.2": { fixedPerYear: 70.608795, energyPerKwh: 0.013172 },
      "RL.3": { fixedPerYear: 190.39456, energyPerKwh: 0.009782 },
      "RL.4": { fixedPerYear: 512.32255, energyPerKwh: 0.012887 },
    },
    source:
      "Prórroga de peajes para el año de gas 2027 (BOE-A-2026-12173); cargos de la Orden TED/1062/2025, que Axpo sigue aplicando en octubre de 2026",
  },
];

/** Peajes y cargos de un peaje en una fecha; null si no se conocen los de ese año de gas. */
export function gasTollsOn(date: string, tariff: GasAccessTariff): GasTolls | null {
  const range = GAS_TOLLS.find(({ from, until }) => from <= date && (until === undefined || date < until));
  return range?.value[tariff] ?? null;
}
