import type { Client } from "@libsql/client";
import type { EnergyByPeriod, PowerByPeriod } from "@/comparador/engine/types";
import type { StudyClientData } from "./client-data";
import { listStudies } from "./repository";
import type { StudySupply, SupplyLocation } from "./supply";

/**
 * Lo que el estudio completado aporta a la comparativa: los datos del
 * cliente, el suministro (factura y SIPS) y la propuesta elegida. Rellena el
 * trámite y la ficha («Datos del estudio»).
 */
export interface NegocoStudyForTramite {
  cups: string | null;
  accessTariff: "2.0TD";
  contractedKw: PowerByPeriod;
  annualKwh: number;
  annualKwhByPeriod: EnergyByPeriod;
  consumptionSource: StudySupply["consumptionSource"];
  sipsMonths: number | null;
  /** Máxima demanda de 12 meses por periodo (SIPS); null sin SIPS. */
  maxDemandKwByPeriod: EnergyByPeriod | null;
  power: { status: "adequate" | "oversized" | "exceeded"; maxDemandKw: number; suggestedKw: number } | null;
  distributor: string | null;
  /** La comercializadora de la factura, para «compañía anterior». */
  currentSupplierName: string | null;
  location: SupplyLocation | null;
  client: StudyClientData | null;
  chosen: {
    proposalId: string;
    number: number;
    comercializadoraName: string;
    productName: string;
    annualTotal: number | null;
    currentTotal: number | null;
    savings: number | null;
    pdfUrl: string;
  } | null;
}

/**
 * El último estudio completado de la comparativa, o null. Si el tenant no
 * tiene el comparador (sin la migración 026 o la 028), también null.
 */
export async function getNegocoStudyForTramite(
  client: Pick<Client, "execute">,
  comparativaId: string,
): Promise<NegocoStudyForTramite | null> {
  try {
    const study = (await listStudies(client, comparativaId)).find(({ status }) => status === "closed");
    if (!study?.supply) return null;
    const { contractedKw, annualKwh, location, power } = study.supply;
    const chosen = study.chosenOffer;
    return {
      cups: study.cups,
      accessTariff: "2.0TD",
      contractedKw,
      annualKwh: Math.round(annualKwh.P1 + annualKwh.P2 + annualKwh.P3),
      annualKwhByPeriod: annualKwh,
      consumptionSource: study.supply.consumptionSource,
      sipsMonths: study.supply.sipsMonths,
      maxDemandKwByPeriod: study.supply.maxDemandKwByPeriod ?? null,
      power: power
        ? { status: power.status, maxDemandKw: power.maxDemandKw, suggestedKw: power.suggestedKw }
        : null,
      distributor: study.supply.distributor ?? null,
      currentSupplierName: study.extraction?.supplierName ?? null,
      location: location ?? null,
      client: study.clientData,
      chosen: chosen
        ? {
            proposalId: chosen.proposalId,
            number: chosen.number,
            comercializadoraName: chosen.comercializadoraName,
            productName: chosen.productName,
            annualTotal: study.chosenTotal,
            currentTotal: study.currentTotal,
            savings: study.savings,
            pdfUrl: `/api/v2/comparador/proposals/${chosen.proposalId}/pdf`,
          }
        : null,
    };
  } catch {
    return null;
  }
}
