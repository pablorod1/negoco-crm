export const TENANT_MODULE_KEYS = ["negoco_studies"] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];

export type TenantModules = Record<TenantModuleKey, boolean>;

export const NO_TENANT_MODULES: TenantModules = Object.freeze({
  negoco_studies: false,
});

export function isTenantModuleKey(value: string): value is TenantModuleKey {
  return (TENANT_MODULE_KEYS as readonly string[]).includes(value);
}
