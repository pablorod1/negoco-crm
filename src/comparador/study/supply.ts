import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { assessPower, type PowerAssessment } from "@/comparador/engine/power";
import type { EnergyByPeriod, PowerByPeriod } from "@/comparador/engine/types";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import type { Territory } from "@/comparador/rates/types";
import type {
  ApoloSipsElectricityConsumptionRow,
  ApoloSipsElectricityPointSupplyRow,
} from "@/integrations/apolo-sips/types";
import type { GasSupplyFacts } from "@/comparador/gas/supply";

/** El suministro tal como se compara, y de dónde sale cada dato. */
export interface StudySupply {
  /**
   * Gas: el consumo va entero en P1 (un solo periodo), sin potencia, y
   * `gas` trae el peaje. Sin el campo, luz.
   */
  energy?: "gas";
  gas?: GasSupplyFacts;
  contractedKw: PowerByPeriod;
  annualKwh: EnergyByPeriod;
  /**
   * De dónde sale el consumo anual: el SIPS (12 meses reales) o la factura
   * llevada a un año, que es una estimación (ver `estimate`).
   */
  consumptionSource: "sips" | "invoice";
  /**
   * El consumo es una estimación con la factura: porque se ha pedido
   * («Estudio sin SIPS») o porque el SIPS no tiene un año. Se dice en el
   * estudio y en el PDF. Falta en los estudios con SIPS.
   */
  estimate?: { reason: "chosen" | "no_sips"; invoiceDays: number } | null;
  /**
   * Consumo real de 12 meses del SIPS cuando el estudio estima con la
   * factura: decide la comisión y las tarifas por tramo de consumo.
   */
  referenceAnnualKwh?: number | null;
  /** Meses de SIPS usados (12 si hay un año entero). */
  sipsMonths: number | null;
  territory: Territory;
  territorySource: "sips" | "default";
  /** Máxima demanda de los últimos 12 meses y lo que dice de la potencia. */
  power: PowerAssessment | null;
  /** Dónde está el suministro según el SIPS, para el contrato. Sin SIPS, null. */
  location?: SupplyLocation | null;
  /** Distribuidora según el SIPS. */
  distributor?: string | null;
  /** Máxima demanda de los últimos 12 meses por periodo (SIPS), en kW. */
  maxDemandKwByPeriod?: EnergyByPeriod | null;
  /**
   * Las lecturas del SIPS que forman el año, tal cual (sin llevar a 365
   * días). Faltan en estudios anteriores al 2026-10-14.
   */
  readings?: SupplyReading[];
  /** Mercado (OMIE) de esas lecturas y de la factura, si su tarifa es indexada. */
  market?: SupplyMarket | null;
}

export interface SupplyReading {
  /** YYYY-MM-DD. */
  from: string;
  to: string;
  kwh: EnergyByPeriod;
}

export interface SupplyMarket {
  source: "omie";
  /**
   * Cómo se pondera cada hora: por el perfil de consumo de REE. Sin el campo,
   * la media simple de las horas (estudios anteriores al 2026-10-15): se recalcula.
   */
  weighting?: "ree_profile";
  /** Media de OMIE por periodo en €/MWh de cada lectura, en el orden de `readings`. */
  readings: EnergyByPeriod[];
  /** Media de OMIE por periodo en el periodo de la factura. */
  invoice: EnergyByPeriod;
  invoicePeriod: { from: string; to: string };
  fetchedAt: string;
}

export interface SupplyLocation {
  postalCode: string | null;
  municipality: string | null;
  province: string | null;
}

/** Provincias por su código INE, como las da el SIPS. */
const PROVINCES: Record<string, string> = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila", "06": "Badajoz",
  "07": "Illes Balears", "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón",
  "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca", "17": "Girona", "18": "Granada",
  "19": "Guadalajara", "20": "Gipuzkoa", "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León",
  "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia", "41": "Sevilla",
  "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid",
  "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

/** Lo que el SIPS de luz y el de gas dan de la dirección del punto de suministro. */
export type SipsPointLocation = Pick<ApoloSipsElectricityPointSupplyRow, "codigoProvinciaPS" | "codigoPostalPS" | "municipioPS">;

/** Código postal, municipio y provincia del punto de suministro. */
export function locationFromSips(point: SipsPointLocation | null): SupplyLocation | null {
  if (!point) return null;
  const text = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);
  const code = text(point.codigoProvinciaPS)?.padStart(2, "0") ?? null;
  const location = {
    postalCode: text(point.codigoPostalPS),
    // En luz el SIPS puede dar el código INE del municipio en vez del nombre.
    municipality: /^\d+$/.test(text(point.municipioPS) ?? "") ? null : text(point.municipioPS),
    province: code ? (PROVINCES[code] ?? null) : null,
  };
  return location.postalCode || location.municipality || location.province ? location : null;
}

const DAY_MS = 86_400_000;
const kwh = (wh: number | null | undefined) => (wh ?? 0) / 1000;

/** Provincia del punto de suministro → territorio de las tarifas. */
export function territoryFromProvince(code: string | null | undefined): Territory | null {
  const province = (code ?? "").trim().padStart(2, "0");
  if (!/^\d{2}$/.test(province) || province === "00") return null;
  if (province === "07") return "baleares";
  if (province === "35" || province === "38") return "canarias";
  if (province === "51" || province === "52") return "ceuta_melilla";
  return "peninsula";
}

/**
 * Días de lecturas por debajo de los cuales no hay un año real. Las lecturas
 * del SIPS no siempre son meses naturales: entre 350 y 365 días cubren el año
 * con algún hueco de un par de semanas como mucho.
 */
export const MIN_SIPS_DAYS = 350;

export type SipsYear =
  | {
      annualKwh: EnergyByPeriod;
      months: number;
      days: number;
      maxDemandKw: number[];
      maxDemandKwByPeriod: EnergyByPeriod;
      readings: SupplyReading[];
    }
  | { insufficient: true; months: number; days: number };

/** Lo que se lee de cada lectura del SIPS; el gas se adapta a esta forma. */
export type SipsConsumptionReading = Pick<
  ApoloSipsElectricityConsumptionRow,
  | "fechaInicioMesConsumo"
  | "fechaFinMesConsumo"
  | "consumoEnergiaActivaEnWhP1"
  | "consumoEnergiaActivaEnWhP2"
  | "consumoEnergiaActivaEnWhP3"
  | "potenciaDemandadaEnWP1"
  | "potenciaDemandadaEnWP2"
  | "potenciaDemandadaEnWP3"
>;

/**
 * Consumo real de los últimos 12 meses del SIPS: las lecturas más recientes
 * hasta cubrir un año, ajustadas a 365 días exactos (unos días arriba o
 * abajo, nunca meses que falten). Con menos de un año de lecturas no hay
 * consumo anual: no se estima. Sin lecturas, null.
 */
export function annualKwhFromSips(rows: readonly SipsConsumptionReading[]): SipsYear | null {
  const dated = rows
    .map((row) => ({
      row,
      from: Date.parse(String(row.fechaInicioMesConsumo ?? "").slice(0, 10)),
      to: Date.parse(String(row.fechaFinMesConsumo ?? "").slice(0, 10)),
    }))
    .filter(({ from, to }) => Number.isFinite(from) && Number.isFinite(to) && to >= from)
    .sort((left, right) => right.to - left.to);
  if (dated.length === 0) return null;

  // Las distribuidoras encadenan las lecturas (una empieza el día en que
  // acaba la anterior) o las dan por meses naturales (del 1 al 31). En el
  // primer caso el día de corte no se cuenta dos veces.
  const chained = dated.some((reading, index) => index > 0 && dated[index - 1].from === reading.to);
  const length = ({ from, to }: { from: number; to: number }) => Math.round((to - from) / DAY_MS) + (chained ? 0 : 1);

  // Las lecturas más recientes hasta cubrir un año.
  const year: typeof dated = [];
  let days = 0;
  for (const reading of dated) {
    if (days >= DAYS_PER_YEAR) break;
    year.push(reading);
    days += length(reading);
  }
  if (days < MIN_SIPS_DAYS) return { insufficient: true, months: year.length, days };

  const total = { P1: 0, P2: 0, P3: 0 };
  const demand: number[] = [];
  const peak = { P1: 0, P2: 0, P3: 0 };
  const readings: SupplyReading[] = [];
  for (const { row, from, to } of year) {
    readings.push({
      from: new Date(from).toISOString().slice(0, 10),
      to: new Date(to).toISOString().slice(0, 10),
      kwh: {
        P1: kwh(row.consumoEnergiaActivaEnWhP1),
        P2: kwh(row.consumoEnergiaActivaEnWhP2),
        P3: kwh(row.consumoEnergiaActivaEnWhP3),
      },
    });
    total.P1 += kwh(row.consumoEnergiaActivaEnWhP1);
    total.P2 += kwh(row.consumoEnergiaActivaEnWhP2);
    total.P3 += kwh(row.consumoEnergiaActivaEnWhP3);
    for (const [period, value] of [
      ["P1", row.potenciaDemandadaEnWP1],
      ["P2", row.potenciaDemandadaEnWP2],
      ["P3", row.potenciaDemandadaEnWP3],
    ] as const) {
      if (typeof value !== "number" || value <= 0) continue;
      demand.push(value / 1000);
      peak[period] = Math.max(peak[period], value / 1000);
    }
  }
  const scale = DAYS_PER_YEAR / days;
  const round = (value: number) => Math.round(value * scale);
  return {
    annualKwh: { P1: round(total.P1), P2: round(total.P2), P3: round(total.P3) },
    months: year.length,
    days,
    maxDemandKw: demand,
    maxDemandKwByPeriod: peak,
    // De la más antigua a la más reciente.
    readings: readings.reverse(),
  };
}

/** Potencia contratada del SIPS (en W) en kW; la 2.0TD a veces la lleva en P3. */
export function contractedKwFromSips(
  point: ApoloSipsElectricityPointSupplyRow | null,
): PowerByPeriod | null {
  if (!point) return null;
  const p1 = point.potenciasContratadasEnWP1;
  const p2 = point.potenciasContratadasEnWP2 ?? point.potenciasContratadasEnWP3;
  if (!p1 || !p2) return null;
  return { P1: p1 / 1000, P2: p2 / 1000 };
}

/** Por qué no hay consumo real: se enseñan tal cual a quien hace el estudio. */
export const SIPS_MESSAGES = {
  noCups: "No se encuentra el CUPS en la factura y sin él no se puede pedir al SIPS el consumo real de 12 meses. Escríbelo aquí o sube la factura completa, con todas sus páginas.",
  noCupsInImage: "No se lee el CUPS en la imagen y sin él no se puede pedir al SIPS el consumo real de 12 meses. Escríbelo aquí tal y como viene en la factura.",
  unavailable:
    "El SIPS no responde ahora mismo y sin él no hay consumo real de 12 meses. Vuelve a intentarlo en unos minutos o marca «Estudio sin SIPS» para estimar con la factura.",
  noReadings: "El SIPS no tiene lecturas de consumo de este CUPS, así que no hay consumo real de 12 meses para comparar.",
  insufficient: (months: number) =>
    `El SIPS solo tiene ${months} ${months === 1 ? "lectura" : "lecturas"} de este suministro (alta o cambio recientes): no hay un año real de consumo para comparar.`,
};

/** Reparto de una 2.0TD doméstica cuando la factura solo da el consumo total. */
const TYPICAL_SHARES = { P1: 0.28, P2: 0.3, P3: 0.42 } as const;

export const ESTIMATE_MESSAGES = {
  noConsumption: "La factura no trae el consumo ni los días del periodo, que hacen falta para estimar el consumo de un año. Revisa la factura o usa el SIPS.",
};

/**
 * Consumo de un año estimado con la factura: el de su periodo llevado a 365
 * días. Si la factura solo da el total (precio único), se reparte como una
 * 2.0TD doméstica. Es una estimación y el estudio lo dice.
 */
export function estimatedAnnualKwh(invoice: Pick<InvoiceExtraction, "billingPeriod" | "consumptionKwh" | "energyLines">): EnergyByPeriod | null {
  const days = invoice.billingPeriod?.days ?? 0;
  if (days <= 0) return null;
  const scale = DAYS_PER_YEAR / days;
  const { P1, P2, P3 } = invoice.consumptionKwh;
  if ((P1 ?? 0) + (P2 ?? 0) + (P3 ?? 0) > 0) {
    return { P1: Math.round((P1 ?? 0) * scale), P2: Math.round((P2 ?? 0) * scale), P3: Math.round((P3 ?? 0) * scale) };
  }
  // Solo líneas de precio único: el kWh de una línea (las demás son conceptos del mismo consumo).
  const total = Math.max(0, ...invoice.energyLines.map(({ kwh }) => kwh));
  if (total <= 0) return null;
  return {
    P1: Math.round(total * TYPICAL_SHARES.P1 * scale),
    P2: Math.round(total * TYPICAL_SHARES.P2 * scale),
    P3: Math.round(total * TYPICAL_SHARES.P3 * scale),
  };
}

export class SupplyUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "SupplyUnavailableError";
  }
}

/**
 * Suministro estimado con la factura: «Estudio sin SIPS» o un SIPS sin un año
 * de lecturas. La potencia y el territorio, del SIPS si responde; si no, de
 * la factura. `referenceAnnualKwh`: el consumo real del SIPS, si lo hay, para
 * las comisiones.
 */
export function buildEstimatedSupply({
  invoice,
  sipsPoint,
  reason,
  referenceAnnualKwh = null,
}: {
  invoice: InvoiceExtraction;
  sipsPoint: ApoloSipsElectricityPointSupplyRow | null;
  reason: "chosen" | "no_sips";
  referenceAnnualKwh?: number | null;
}): StudySupply {
  const annualKwh = estimatedAnnualKwh(invoice);
  if (!annualKwh) throw new SupplyUnavailableError(ESTIMATE_MESSAGES.noConsumption);
  const invoiceKw =
    invoice.contractedKw.P1 && invoice.contractedKw.P2 ? { P1: invoice.contractedKw.P1, P2: invoice.contractedKw.P2 } : null;
  const contractedKw = contractedKwFromSips(sipsPoint) ?? invoiceKw;
  if (!contractedKw) throw new SupplyUnavailableError("No hay potencia contratada: ni el SIPS ni la factura la dan.");
  const territory = territoryFromProvince(sipsPoint?.codigoProvinciaPS);
  return {
    contractedKw,
    annualKwh,
    consumptionSource: "invoice",
    estimate: { reason, invoiceDays: invoice.billingPeriod!.days },
    referenceAnnualKwh,
    sipsMonths: null,
    territory: territory ?? "peninsula",
    territorySource: territory ? "sips" : "default",
    power: null,
    location: locationFromSips(sipsPoint),
    distributor: sipsPoint?.nombreEmpresaDistribuidora?.trim() || null,
    maxDemandKwByPeriod: null,
  };
}

/**
 * Suministro del estudio: el consumo real de 12 meses del SIPS y la potencia
 * del SIPS o, si no la da, la de la factura. Sin un año de SIPS no hay
 * estudio: el consumo de una factura no dice lo que gasta en un año.
 */
export function buildSupply({
  invoice,
  sipsPoint,
  sipsConsumption,
}: {
  invoice: InvoiceExtraction;
  sipsPoint: ApoloSipsElectricityPointSupplyRow | null;
  sipsConsumption: readonly ApoloSipsElectricityConsumptionRow[];
}): StudySupply {
  const fromSips = annualKwhFromSips(sipsConsumption);
  if (!fromSips) throw new SupplyUnavailableError(SIPS_MESSAGES.noReadings);
  if ("insufficient" in fromSips) throw new SupplyUnavailableError(SIPS_MESSAGES.insufficient(fromSips.months));
  const annualKwh = fromSips.annualKwh;

  const invoiceKw =
    invoice.contractedKw.P1 && invoice.contractedKw.P2
      ? { P1: invoice.contractedKw.P1, P2: invoice.contractedKw.P2 }
      : null;
  const contractedKw = contractedKwFromSips(sipsPoint) ?? invoiceKw;
  if (!contractedKw) {
    throw new SupplyUnavailableError(
      "No hay potencia contratada: ni el SIPS ni la factura la dan.",
    );
  }

  const territory = territoryFromProvince(sipsPoint?.codigoProvinciaPS);
  return {
    contractedKw,
    annualKwh,
    consumptionSource: "sips",
    sipsMonths: fromSips.months,
    territory: territory ?? "peninsula",
    territorySource: territory ? "sips" : "default",
    power: fromSips.maxDemandKw.length > 0 ? assessPower(contractedKw, fromSips.maxDemandKw) : null,
    location: locationFromSips(sipsPoint),
    distributor: sipsPoint?.nombreEmpresaDistribuidora?.trim() || null,
    maxDemandKwByPeriod: fromSips.maxDemandKw.length > 0 ? fromSips.maxDemandKwByPeriod : null,
    readings: fromSips.readings,
  };
}
