import type { Client } from "@libsql/client";
import type { StudyClientData } from "./client-data";
import { listStudies } from "./repository";
import type { SupplyLocation } from "./supply";

/** Lo que el estudio completado aporta al trámite de la comparativa. */
export interface NegocoStudyForTramite {
  cups: string | null;
  accessTariff: "2.0TD";
  contractedKw: { P1: number; P2: number };
  annualKwh: number;
  /** La comercializadora de la factura, para «compañía anterior». */
  currentSupplierName: string | null;
  location: SupplyLocation | null;
  client: StudyClientData | null;
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
    const { contractedKw, annualKwh, location } = study.supply;
    return {
      cups: study.cups,
      accessTariff: "2.0TD",
      contractedKw,
      annualKwh: Math.round(annualKwh.P1 + annualKwh.P2 + annualKwh.P3),
      currentSupplierName: study.extraction?.supplierName ?? null,
      location: location ?? null,
      client: study.clientData,
    };
  } catch {
    return null;
  }
}
