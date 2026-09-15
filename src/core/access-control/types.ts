import type { PermissionKey } from "./catalog";

export type AccessControlRole = "admin" | "1" | "2";
export type ConfigurableRole = Exclude<AccessControlRole, "admin">;
export type TenantCapability = "ai_studies";

export interface PermissionDefinition {
  key: string;
  group: string;
  label: string;
  description: string;
  requiredCapability?: TenantCapability;
  defaults: Record<AccessControlRole, boolean>;
}

export type PublicPermissionDefinition = Omit<
  PermissionDefinition,
  "requiredCapability"
>;

export type PermissionMap = Record<PermissionKey, boolean>;
export type PermissionSettings = Partial<PermissionMap>;
export type PublicPermissionMap = Record<string, boolean>;

export interface PermissionResolutionInput {
  userRole: string;
  roleSettings?: PermissionSettings;
  userOverrides?: PermissionSettings;
}

export interface AccessControlRoleSnapshot {
  id: ConfigurableRole;
  label: string;
  permissions: PublicPermissionMap;
  settings: PublicPermissionMap;
}

export interface UserPermissionOverride {
  user_id: string;
  permission_key: string;
  enabled: boolean;
}

export interface AccessControlSnapshot {
  catalog: readonly PublicPermissionDefinition[];
  roles: AccessControlRoleSnapshot[];
  user_overrides: UserPermissionOverride[];
}

export type AccessControlUpdate =
  | {
      subject_type: "role";
      subject_id: string;
      permission_key: string;
      enabled: boolean | null;
    }
  | {
      subject_type: "user";
      subject_id: string;
      permission_key: string;
      enabled: boolean | null;
    };
