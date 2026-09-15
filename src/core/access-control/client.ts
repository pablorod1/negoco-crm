import {
  getDefaultPermission,
  isPermissionKey,
  type PermissionKey,
} from "./catalog";
import type { PermissionSettings } from "./types";

export function hasPermission(
  permissions: PermissionSettings | null | undefined,
  role: string,
  permissionKey: string,
): boolean {
  if (!isPermissionKey(permissionKey)) return false;
  if (role === "admin") return true;

  const explicitValue = permissions?.[permissionKey as PermissionKey];
  if (typeof explicitValue === "boolean") return explicitValue;

  return getDefaultPermission(role, permissionKey);
}
