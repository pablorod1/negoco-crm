import type { Client, InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { normalizeName } from "./names";
import {
  getActiveVersion,
  getVersionPrices,
  insertPriceStatement,
  insertTenantRateStatement,
  insertVersionStatements,
  listTenantRates,
} from "./repository";

type TenantClient = Pick<Client, "execute" | "batch">;

export interface CopyPlanEntry {
  supplier: string;
  sourceVersionId: string;
  validFrom: string;
  rows: number;
  /** Tarifas del catálogo que el destino aún no tiene y se crearán. */
  newRates: string[];
  /** Filas sin enlace al catálogo: no se copian, porque no se pueden casar. */
  skippedRows: number;
  statements: InStatement[];
}

/**
 * Plan para copiar los precios vigentes de un tenant a otro (el de demo
 * recibe los de Beenergy). Las comercializadoras se casan por nombre y las
 * tarifas por su enlace al catálogo; los COM-xxx no coinciden entre tenants.
 */
export async function planRatesCopy({
  from,
  to,
  today,
  userId,
}: {
  from: TenantClient;
  to: TenantClient;
  today: string;
  userId: string;
}): Promise<{ entries: CopyPlanEntry[]; missingSuppliers: string[] }> {
  const [sourceSuppliers, targetSuppliers] = await Promise.all([
    from.execute("SELECT id, name FROM comercializadoras"),
    to.execute("SELECT id, name FROM comercializadoras"),
  ]);
  const targetByKey = new Map(
    targetSuppliers.rows.map((row) => [normalizeName(String(row.name)), String(row.id)]),
  );

  const entries: CopyPlanEntry[] = [];
  const missingSuppliers: string[] = [];
  for (const supplier of sourceSuppliers.rows) {
    const sourceId = String(supplier.id);
    const name = String(supplier.name);
    const active = await getActiveVersion(from, sourceId, today);
    if (!active?.validFrom) continue;

    const targetId = targetByKey.get(normalizeName(name));
    if (!targetId) {
      missingSuppliers.push(name);
      continue;
    }

    const prices = await getVersionPrices(from, active.id);
    const targetRates = await listTenantRates(to, targetId);
    const targetByCatalog = new Map(
      targetRates.filter((rate) => rate.catalogRateId).map((rate) => [rate.catalogRateId!, rate.id]),
    );

    const statements: InStatement[] = [];
    const newRates: string[] = [];
    let skippedRows = 0;
    const versionId = randomUUID();
    const version = insertVersionStatements({
      version: {
        id: versionId,
        comercializadoraId: targetId,
        validFrom: active.validFrom,
        validTo: active.validTo,
        source: "copy",
        ingestId: null,
        basedOnVersionId: null,
        notes: `Copia de la versión ${active.id}`,
        userId,
      },
      today,
    });
    statements.push(...version.statements);

    for (const price of prices) {
      if (!price.catalogRateId) {
        skippedRows++;
        continue;
      }
      let rateId = targetByCatalog.get(price.catalogRateId);
      if (!rateId) {
        rateId = randomUUID();
        targetByCatalog.set(price.catalogRateId, rateId);
        newRates.push(price.rateName);
        statements.push(
          insertTenantRateStatement({
            id: rateId,
            name: price.rateName,
            comercializadoraId: targetId,
            catalogRateId: price.catalogRateId,
            accessTariff: price.accessTariff,
          }),
        );
      }
      statements.push(
        insertPriceStatement(versionId, { ...price, rateId, sourceValues: null }),
      );
    }

    if (prices.length > skippedRows) {
      entries.push({
        supplier: name,
        sourceVersionId: active.id,
        validFrom: active.validFrom,
        rows: prices.length - skippedRows,
        newRates,
        skippedRows,
        statements,
      });
    }
  }
  return { entries, missingSuppliers };
}
