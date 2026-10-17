import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { getTursoControlClient } from "@/core/libsql/client";
import type { RateExtractionResult } from "./extract";

/**
 * Lecturas de anexos por huella del fichero. Las comercializadoras mandan el
 * mismo anexo a todas las agencias: el primer tenant que lo recibe paga la
 * lectura y los demás la reutilizan sin llamar a la IA. Solo se comparte la
 * lectura; cada tenant aprueba la suya. Vive en la base de control
 * (migración 031). Un anexo personalizado para un canal es otro fichero y se
 * lee aparte.
 */
export interface ReadingCache {
  find(sha256: string): Promise<{ result: RateExtractionResult; tenantSlug: string } | null>;
  save(input: { sha256: string; fileName: string; result: RateExtractionResult; tenantSlug: string }): Promise<void>;
}

export function fileHash(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Solo se comparten las lecturas buenas: una dudosa se vuelve a leer en cada tenant. */
export function worthSharing(result: RateExtractionResult): boolean {
  return result.status === "ok" || result.status === "out_of_scope";
}

/**
 * La caché es un ahorro: si la base de control falla (o falta la migración),
 * se lee el anexo como siempre.
 */
export function controlReadingCache(getClient: () => Pick<Client, "execute"> = getTursoControlClient): ReadingCache {
  return {
    async find(sha256) {
      try {
        const client = getClient();
        const { rows } = await client.execute({
          sql: "SELECT result, tenant_slug FROM rate_document_readings WHERE sha256 = ?",
          args: [sha256],
        });
        if (!rows[0]) return null;
        await client.execute({
          sql: "UPDATE rate_document_readings SET uses = uses + 1, last_used_at = CURRENT_TIMESTAMP WHERE sha256 = ?",
          args: [sha256],
        });
        return { result: JSON.parse(String(rows[0].result)) as RateExtractionResult, tenantSlug: String(rows[0].tenant_slug) };
      } catch (error) {
        console.warn("[comparador] caché de lecturas no disponible", error instanceof Error ? error.message : error);
        return null;
      }
    },

    async save({ sha256, fileName, result, tenantSlug }) {
      try {
        const supplierName =
          result.status === "out_of_scope" ? result.classification.supplierName : result.extraction.supplierName;
        await getClient().execute({
          sql: `INSERT INTO rate_document_readings (sha256, file_name, supplier_name, result, cost_usd, tenant_slug)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (sha256) DO UPDATE SET
              supplier_name = excluded.supplier_name,
              result = excluded.result,
              cost_usd = excluded.cost_usd,
              tenant_slug = excluded.tenant_slug,
              updated_at = CURRENT_TIMESTAMP`,
          args: [sha256, fileName, supplierName ?? null, JSON.stringify(result), result.costUsd, tenantSlug],
        });
      } catch (error) {
        console.warn("[comparador] no se ha guardado la lectura en la caché", error instanceof Error ? error.message : error);
      }
    },
  };
}

/** Caché en memoria para los tests. */
export function memoryReadingCache(): ReadingCache & { entries: Map<string, { result: RateExtractionResult; tenantSlug: string }> } {
  const entries = new Map<string, { result: RateExtractionResult; tenantSlug: string }>();
  return {
    entries,
    async find(sha256) {
      return entries.get(sha256) ?? null;
    },
    async save({ sha256, result, tenantSlug }) {
      entries.set(sha256, { result, tenantSlug });
    },
  };
}
