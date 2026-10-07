import type { Client } from "@libsql/client";
import type { NextRequest } from "next/server";
import type { TenantCapability } from "@/core/access-control/types";
import { getTursoControlClient } from "@/core/libsql/client";
import { getTenantInfoFromRequest } from "@/crm-settings/utils";
import {
  NO_TENANT_MODULES,
  isTenantModuleKey,
  type TenantModules,
} from "./types";

const CACHE_TTL_MS = 60_000;

type QueryClient = Pick<Client, "execute">;

const cache = new Map<string, { modules: TenantModules; expiresAt: number }>();

/**
 * Módulos contratados por un tenant, leídos de la base de control.
 *
 * Se cachean por instancia durante un minuto para no añadir una consulta a la
 * base de control en cada petición. Si la base de control no responde, todos
 * los módulos cuentan como desactivados: un fallo nunca abre un módulo.
 */
export async function getTenantModules(
  tenantSlug: string,
  options: { client?: QueryClient; now?: number } = {},
): Promise<TenantModules> {
  const now = options.now ?? Date.now();
  const cached = cache.get(tenantSlug);
  if (cached && cached.expiresAt > now) return cached.modules;

  try {
    const client = options.client ?? getTursoControlClient();
    const response = await client.execute({
      sql: `SELECT module_key, enabled
        FROM tenant_modules
        WHERE tenant_slug = ?`,
      args: [tenantSlug],
    });

    const modules: TenantModules = { ...NO_TENANT_MODULES };
    for (const row of response.rows) {
      const moduleKey = String(row.module_key);
      if (!isTenantModuleKey(moduleKey)) continue;
      modules[moduleKey] = Number(row.enabled) === 1;
    }

    cache.set(tenantSlug, { modules, expiresAt: now + CACHE_TTL_MS });
    return modules;
  } catch (error) {
    console.error("[tenant-modules] could not read tenant modules", {
      tenantSlug,
      error,
    });
    return { ...NO_TENANT_MODULES };
  }
}

export async function getTenantModulesForRequest(
  request: NextRequest,
): Promise<TenantModules> {
  let tenantSlug: string;
  try {
    tenantSlug = getTenantInfoFromRequest(request).tenant_slug;
  } catch {
    return { ...NO_TENANT_MODULES };
  }
  return getTenantModules(tenantSlug);
}

/** Capacidades de permisos que abre cada módulo contratado. */
export function getModuleCapabilities(
  modules: TenantModules,
): TenantCapability[] {
  return modules.negoco_studies ? ["negoco_studies"] : [];
}

export function clearTenantModulesCache(): void {
  cache.clear();
}
