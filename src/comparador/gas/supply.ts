import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import {
  annualKwhFromSips,
  locationFromSips,
  ESTIMATE_MESSAGES,
  SIPS_MESSAGES,
  SupplyUnavailableError,
  territoryFromProvince,
  type SipsConsumptionReading,
  type StudySupply,
} from "@/comparador/study/supply";
import type { ApoloSipsGasConsumptionRow, ApoloSipsGasPointSupplyRow } from "@/integrations/apolo-sips/types";
import { GAS_TARIFF_MAX_KWH, gasTariffForKwh, normalizeGasTariff, type GasAccessTariff } from "./regulated";

/** Lo propio de un suministro de gas. */
export interface GasSupplyFacts {
  /** Peaje con el que se oferta: el que tiene en vigor (SIPS o factura) o, sin él, el de su consumo. */
  accessTariff: GasAccessTariff;
  tariffSource: "sips" | "invoice" | "consumption";
  /** El peaje que le corresponde por el consumo de 12 meses, si es otro: la distribuidora lo revisa cada año. */
  consumptionTariff: GasAccessTariff | null;
  /** Si el punto tiene derecho a la TUR, según el SIPS; null si no lo dice. */
  turEligible: boolean | null;
}

/**
 * Las lecturas de gas en la forma de las de luz: todo el consumo en P1 (el
 * gas no tiene periodos) y sin potencia. P2 es el consumo nocturno de algunos
 * peajes antiguos: se suma.
 */
export function gasReadingsFromSips(rows: readonly ApoloSipsGasConsumptionRow[]): SipsConsumptionReading[] {
  return rows.map((row) => ({
    fechaInicioMesConsumo: row.fechaInicioMesConsumo,
    fechaFinMesConsumo: row.fechaFinMesConsumo,
    consumoEnergiaActivaEnWhP1: (row.consumoEnWhP1 ?? 0) + (row.consumoEnWhP2 ?? 0),
    consumoEnergiaActivaEnWhP2: 0,
    consumoEnergiaActivaEnWhP3: 0,
    potenciaDemandadaEnWP1: null,
    potenciaDemandadaEnWP2: null,
    potenciaDemandadaEnWP3: null,
  }));
}

/** «S», «SI», «1», «true» → true; «N», «NO», «0» → false; lo demás, null. */
function yesNo(value: string | null | undefined): boolean | null {
  const text = (value ?? "").trim().toUpperCase();
  if (["S", "SI", "SÍ", "1", "TRUE", "Y"].includes(text)) return true;
  if (["N", "NO", "0", "FALSE"].includes(text)) return false;
  return null;
}

export const GAS_SUPPLY_MESSAGES = {
  satellite:
    "El punto está conectado a una planta satélite (peajes RLPS), que tiene sus propios precios: el comparador aún no lo compara.",
  tooBig: (kwh: number) =>
    `Consume ${Math.round(kwh).toLocaleString("es-ES")} kWh de gas al año: por encima de ${GAS_TARIFF_MAX_KWH["RL.4"].toLocaleString("es-ES")} kWh (RL.5 en adelante) el comparador no compara.`,
};

/**
 * Suministro de gas del estudio: el consumo real de 12 meses del SIPS (sin él
 * no hay estudio) y el peaje. Las lecturas de gas suelen ser bimestrales: se
 * toman las más recientes hasta cubrir un año y se llevan a 365 días.
 */
export function buildGasSupply({
  invoice,
  sipsPoint,
  sipsConsumption,
}: {
  invoice: Pick<InvoiceExtraction, "accessTariff">;
  sipsPoint: ApoloSipsGasPointSupplyRow | null;
  sipsConsumption: readonly ApoloSipsGasConsumptionRow[];
}): StudySupply {
  const fromSips = annualKwhFromSips(gasReadingsFromSips(sipsConsumption));
  if (!fromSips) throw new SupplyUnavailableError(SIPS_MESSAGES.noReadings);
  if ("insufficient" in fromSips) throw new SupplyUnavailableError(SIPS_MESSAGES.insufficient(fromSips.months));

  // Planta satélite: código S1… del SIPS (GAS_TIPO_PEAJE) o la marca del punto.
  if (/^S\d$/i.test(sipsPoint?.codigoPeajeEnVigor?.trim() ?? "") || yesNo(sipsPoint?.conectadoPlantaSatelite) === true) {
    throw new SupplyUnavailableError(GAS_SUPPLY_MESSAGES.satellite);
  }
  const annual = fromSips.annualKwh.P1;
  const byConsumption = gasTariffForKwh(annual);
  if (!byConsumption) throw new SupplyUnavailableError(GAS_SUPPLY_MESSAGES.tooBig(annual));
  const fromPoint = normalizeGasTariff(sipsPoint?.codigoPeajeEnVigor);
  const fromInvoice = normalizeGasTariff(invoice.accessTariff);
  const accessTariff = fromPoint ?? fromInvoice ?? byConsumption;

  const territory = territoryFromProvince(sipsPoint?.codigoProvinciaPS);
  const location = sipsPoint
    ? locationFromSips({
        codigoProvinciaPS: sipsPoint.codigoProvinciaPS,
        codigoPostalPS: sipsPoint.codigoPostalPS,
        // El de gas trae el nombre del municipio aparte del código.
        municipioPS: sipsPoint.desmunicipioPS ?? sipsPoint.municipioPS,
      })
    : null;
  return {
    energy: "gas",
    gas: {
      accessTariff,
      tariffSource: fromPoint ? "sips" : fromInvoice ? "invoice" : "consumption",
      consumptionTariff: byConsumption !== accessTariff ? byConsumption : null,
      turEligible: yesNo(sipsPoint?.derechoTUR),
    },
    contractedKw: { P1: 0, P2: 0 },
    annualKwh: { P1: annual, P2: 0, P3: 0 },
    consumptionSource: "sips",
    sipsMonths: fromSips.months,
    territory: territory ?? "peninsula",
    territorySource: territory ? "sips" : "default",
    power: null,
    location,
    distributor: sipsPoint?.nombreEmpresaDistribuidora?.trim() || null,
    maxDemandKwByPeriod: null,
    readings: fromSips.readings,
  };
}

/**
 * Suministro de gas estimado con la factura («Estudio sin SIPS» o sin un año
 * de lecturas): su consumo llevado a 365 días. En gas pesa mucho la estación
 * de la factura: el estudio dice que es una estimación. El peaje, el del SIPS
 * o la factura; si no, el del consumo real (`referenceAnnualKwh`) o el estimado.
 */
export function buildEstimatedGasSupply({
  invoice,
  sipsPoint,
  reason,
  referenceAnnualKwh = null,
}: {
  invoice: Pick<InvoiceExtraction, "accessTariff" | "billingPeriod" | "consumptionKwh">;
  sipsPoint: ApoloSipsGasPointSupplyRow | null;
  reason: "chosen" | "no_sips";
  referenceAnnualKwh?: number | null;
}): StudySupply {
  const days = invoice.billingPeriod?.days ?? 0;
  const consumed = invoice.consumptionKwh.P1 ?? 0;
  if (days <= 0 || consumed <= 0) throw new SupplyUnavailableError(ESTIMATE_MESSAGES.noConsumption);
  const annual = Math.round((consumed * DAYS_PER_YEAR) / days);
  const byConsumption = gasTariffForKwh(referenceAnnualKwh ?? annual);
  if (!byConsumption) throw new SupplyUnavailableError(GAS_SUPPLY_MESSAGES.tooBig(referenceAnnualKwh ?? annual));
  if (/^S\d$/i.test(sipsPoint?.codigoPeajeEnVigor?.trim() ?? "") || yesNo(sipsPoint?.conectadoPlantaSatelite) === true) {
    throw new SupplyUnavailableError(GAS_SUPPLY_MESSAGES.satellite);
  }
  const fromPoint = normalizeGasTariff(sipsPoint?.codigoPeajeEnVigor);
  const fromInvoice = normalizeGasTariff(invoice.accessTariff);
  const accessTariff = fromPoint ?? fromInvoice ?? byConsumption;
  const territory = territoryFromProvince(sipsPoint?.codigoProvinciaPS);
  return {
    energy: "gas",
    gas: {
      accessTariff,
      tariffSource: fromPoint ? "sips" : fromInvoice ? "invoice" : "consumption",
      consumptionTariff: byConsumption !== accessTariff ? byConsumption : null,
      turEligible: yesNo(sipsPoint?.derechoTUR),
    },
    contractedKw: { P1: 0, P2: 0 },
    annualKwh: { P1: annual, P2: 0, P3: 0 },
    consumptionSource: "invoice",
    estimate: { reason, invoiceDays: days },
    referenceAnnualKwh,
    sipsMonths: null,
    territory: territory ?? "peninsula",
    territorySource: territory ? "sips" : "default",
    power: null,
    location: sipsPoint
      ? locationFromSips({ codigoProvinciaPS: sipsPoint.codigoProvinciaPS, codigoPostalPS: sipsPoint.codigoPostalPS, municipioPS: sipsPoint.desmunicipioPS ?? sipsPoint.municipioPS })
      : null,
    distributor: sipsPoint?.nombreEmpresaDistribuidora?.trim() || null,
    maxDemandKwByPeriod: null,
  };
}
