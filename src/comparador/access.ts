import { hasPermission } from "@/core/access-control/client";
import type { PermissionSettings } from "@/core/access-control/types";
import type { TenantModules } from "@/core/modules/types";

export interface NegocoStudiesAccessInput {
  modules: TenantModules | null | undefined;
  role: string;
  isSubcomercial: boolean;
  permissions: PermissionSettings | null | undefined;
}

/**
 * Quién puede usar el comparador propio. Es la misma regla en el botón y en
 * las rutas: el tenant tiene el módulo contratado, el usuario puede completar
 * estudios, tiene el permiso del comparador y no es subcomercial.
 */
export function canUseNegocoStudies({
  modules,
  role,
  isSubcomercial,
  permissions,
}: NegocoStudiesAccessInput): boolean {
  if (!modules?.negoco_studies) return false;
  if (isSubcomercial) return false;

  return (
    hasPermission(permissions, role, "comparisons.study.complete") &&
    hasPermission(permissions, role, "comparisons.study.negoco")
  );
}

/**
 * Quién sube anexos y aprueba versiones de precios: quien puede usar el
 * comparador y además es admin o backoffice. Los precios de un tenant los
 * gestiona su oficina, no los comerciales.
 */
export function canManageRates(input: NegocoStudiesAccessInput): boolean {
  return (
    canUseNegocoStudies(input) && (input.role === "admin" || input.role === "1")
  );
}

/**
 * Dar de alta tarifas en el catálogo único es cosa de Negoco: lo puede hacer
 * quien figure en `COMPARADOR_CATALOG_ADMINS` (correos separados por comas).
 */
export function isCatalogAdmin(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!email) return false;
  const admins = (env.COMPARADOR_CATALOG_ADMINS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
