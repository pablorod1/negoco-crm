import type {
  AccessControlRole,
  ConfigurableRole,
  PermissionDefinition,
  PermissionMap,
} from "./types";

export const CONFIGURABLE_ROLES = [
  { id: "1", label: "Backoffice" },
  { id: "2", label: "Comercial" },
] as const satisfies readonly {
  id: ConfigurableRole;
  label: string;
}[];

export const PERMISSION_CATALOG = [
  {
    key: "comparisons.study.complete",
    group: "Comparativas",
    label: "Completar estudios",
    description:
      "Permite completar o rechazar estudios pendientes, de forma manual o con IA cuando esté disponible.",
    defaults: {
      admin: true,
      "1": true,
      "2": false,
    },
  },
  {
    key: "comparisons.study.review",
    group: "Comparativas",
    label: "Revisar estudios con IA",
    description:
      "Permite validar el resultado recibido y completar el estudio.",
    requiredCapability: "ai_studies",
    defaults: {
      admin: true,
      "1": true,
      "2": false,
    },
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]["key"];

export const PERMISSION_KEYS: readonly PermissionKey[] = Object.freeze(
  PERMISSION_CATALOG.map(({ key }) => key),
);

const permissionKeys = new Set<string>(PERMISSION_KEYS);

export function isPermissionKey(key: string): key is PermissionKey {
  return permissionKeys.has(key);
}

export function getDefaultPermission(
  role: string,
  permissionKey: string,
): boolean {
  if (!isPermissionKey(permissionKey)) return false;
  if (role !== "admin" && role !== "1" && role !== "2") return false;

  const definition = PERMISSION_CATALOG.find(
    ({ key }) => key === permissionKey,
  );

  return definition?.defaults[role as AccessControlRole] ?? false;
}

export function getDefaultPermissions(role: string): PermissionMap {
  return Object.fromEntries(
    PERMISSION_KEYS.map((permissionKey) => [
      permissionKey,
      getDefaultPermission(role, permissionKey),
    ]),
  ) as PermissionMap;
}
