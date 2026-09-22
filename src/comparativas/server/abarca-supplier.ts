import type { Client } from "@libsql/client";
import { resolveAbarcaSupplier, type AbarcaSupplierMapping } from "@/comparativas/utils/abarca-supplier";

/** Sólo datos del tenant: ninguna llamada a Abarca durante un webhook. */
export async function resolveTenantAbarcaSupplier(
  db: Pick<Client, "execute">,
  name: string | null | undefined,
  segment?: string | null,
) {
  const suppliers = (await db.execute("SELECT id, name FROM comercializadoras ORDER BY id")).rows
    .map((row) => ({ id: String(row.id), name: String(row.name) }));
  const exists = (await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'abarca_supplier_mappings'")).rows.length;
  // Compatibilidad con tenants aún no importados; no ocultar errores de BD.
  const mappings: AbarcaSupplierMapping[] = exists ? (await db.execute(`
    SELECT abarca_name, segment, comercializadora_id FROM abarca_supplier_mappings
    WHERE abarca_user_id IN (SELECT abarca_user_id FROM organization)
    ORDER BY segment, name_key
  `)).rows.map((row) => ({
    abarca_name: String(row.abarca_name), segment: String(row.segment),
    comercializadora_id: row.comercializadora_id == null ? null : String(row.comercializadora_id),
  })) : [];
  return { ...resolveAbarcaSupplier(name, suppliers, mappings, segment), suppliers, mappings };
}
