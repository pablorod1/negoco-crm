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
