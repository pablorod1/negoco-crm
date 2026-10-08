import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { assessPower, type PowerAssessment } from "@/comparador/engine/power";
import type { EnergyByPeriod, PowerByPeriod } from "@/comparador/engine/types";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import type { Territory } from "@/comparador/rates/types";
import type {
  ApoloSipsElectricityConsumptionRow,
  ApoloSipsElectricityPointSupplyRow,
} from "@/integrations/apolo-sips/types";

/** El suministro tal como se compara, y de dónde sale cada dato. */
export interface StudySupply {
  contractedKw: PowerByPeriod;
  annualKwh: EnergyByPeriod;
  /** De dónde sale el consumo anual. */
  consumptionSource: "sips" | "invoice";
  /** Meses de SIPS usados (12 si hay un año entero). */
  sipsMonths: number | null;
  territory: Territory;
  territorySource: "sips" | "default";
  /** Máxima demanda de los últimos 12 meses y lo que dice de la potencia. */
  power: PowerAssessment | null;
  /** Dónde está el suministro según el SIPS, para el contrato. Sin SIPS, null. */
  location?: SupplyLocation | null;
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

/** Código postal, municipio y provincia del punto de suministro. */
export function locationFromSips(point: ApoloSipsElectricityPointSupplyRow | null): SupplyLocation | null {
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
 * Consumo anual de los últimos 12 meses del SIPS. Si hay menos de un año, se
 * lleva a 365 días con los que haya; sin lecturas, null.
 */
export function annualKwhFromSips(
  rows: readonly ApoloSipsElectricityConsumptionRow[],
): { annualKwh: EnergyByPeriod; months: number; maxDemandKw: number[] } | null {
  const dated = rows
    .map((row) => ({
      row,
      from: Date.parse(String(row.fechaInicioMesConsumo ?? "").slice(0, 10)),
      to: Date.parse(String(row.fechaFinMesConsumo ?? "").slice(0, 10)),
    }))
    .filter(({ from, to }) => Number.isFinite(from) && Number.isFinite(to) && to >= from)
    .sort((left, right) => right.to - left.to);
  if (dated.length === 0) return null;

  // Los meses que caben en el último año de lecturas.
  const latest = dated[0].to;
  const year = dated.filter(({ from }) => from > latest - DAYS_PER_YEAR * DAY_MS);
  const days = year.reduce((sum, { from, to }) => sum + Math.round((to - from) / DAY_MS) + 1, 0);
  if (days <= 0) return null;

  const total = { P1: 0, P2: 0, P3: 0 };
  const demand: number[] = [];
  for (const { row } of year) {
    total.P1 += kwh(row.consumoEnergiaActivaEnWhP1);
    total.P2 += kwh(row.consumoEnergiaActivaEnWhP2);
    total.P3 += kwh(row.consumoEnergiaActivaEnWhP3);
    for (const value of [
      row.potenciaDemandadaEnWP1,
      row.potenciaDemandadaEnWP2,
      row.potenciaDemandadaEnWP3,
    ]) {
      if (typeof value === "number" && value > 0) demand.push(value / 1000);
    }
  }
  const scale = Math.min(DAYS_PER_YEAR / days, 12);
  const round = (value: number) => Math.round(value * scale);
  return {
    annualKwh: { P1: round(total.P1), P2: round(total.P2), P3: round(total.P3) },
    months: year.length,
    maxDemandKw: demand,
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

/** Consumo de la factura llevado a un año. */
export function annualKwhFromInvoice(invoice: InvoiceExtraction): EnergyByPeriod | null {
  const days = invoice.billingPeriod?.days ?? 0;
  const { P1, P2, P3 } = invoice.consumptionKwh;
  if (days <= 0 || P1 === null || P2 === null || P3 === null) return null;
  const scale = DAYS_PER_YEAR / days;
  return { P1: Math.round(P1 * scale), P2: Math.round(P2 * scale), P3: Math.round(P3 * scale) };
}

export class SupplyUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "SupplyUnavailableError";
  }
}

/**
 * Suministro del estudio: el consumo de 12 meses y la potencia del SIPS si
 * los hay, y si no, los de la factura (llevada a un año).
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
  const annualKwh = fromSips?.annualKwh ?? annualKwhFromInvoice(invoice);
  if (!annualKwh) {
    throw new SupplyUnavailableError(
      "No hay consumo: ni el SIPS lo da ni la factura trae el consumo por periodo y los días.",
    );
  }

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
    consumptionSource: fromSips ? "sips" : "invoice",
    sipsMonths: fromSips?.months ?? null,
    territory: territory ?? "peninsula",
    territorySource: territory ? "sips" : "default",
    power: fromSips ? assessPower(contractedKw, fromSips.maxDemandKw) : null,
    location: locationFromSips(sipsPoint),
  };
}
