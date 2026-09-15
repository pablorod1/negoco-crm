import type { Client, Transaction } from "@libsql/client";
import {
  CONFIGURABLE_ROLES,
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  getDefaultPermission,
  isPermissionKey,
  type PermissionKey,
} from "./catalog";
import { hasAiStudiesCapability } from "./capabilities";
import type {
  AccessControlSnapshot,
  AccessControlUpdate,
  ConfigurableRole,
  PermissionDefinition,
  PermissionMap,
  PermissionResolutionInput,
  PermissionSettings,
  PublicPermissionDefinition,
  UserPermissionOverride,
} from "./types";

type QueryClient = Pick<Client, "execute">;
type WriteTransaction = Pick<
  Transaction,
  "execute" | "commit" | "rollback"
>;
type TransactionClient = {
  transaction(mode: "write"): Promise<WriteTransaction>;
};

export function resolveEffectivePermission(
  input: PermissionResolutionInput,
  permissionKey: string,
): boolean {
  if (!isPermissionKey(permissionKey)) return false;
  if (input.userRole === "admin") return true;

  const userValue = input.userOverrides?.[permissionKey];
  if (typeof userValue === "boolean") return userValue;

  const roleValue = input.roleSettings?.[permissionKey];
  if (typeof roleValue === "boolean") return roleValue;

  return getDefaultPermission(input.userRole, permissionKey);
}

export function resolveEffectivePermissions(
  input: PermissionResolutionInput,
): PermissionMap {
  return Object.fromEntries(
    PERMISSION_KEYS.map((permissionKey) => [
      permissionKey,
      resolveEffectivePermission(input, permissionKey),
    ]),
  ) as PermissionMap;
}

function rowsToPermissionSettings(
  rows: readonly Record<string, unknown>[],
): PermissionSettings {
  const settings: PermissionSettings = {};

  for (const row of rows) {
    const permissionKey = String(row.permission_key);
    if (!isPermissionKey(permissionKey)) continue;
    settings[permissionKey] = Number(row.enabled) === 1;
  }

  return settings;
}

export async function getEffectivePermissions(
  client: QueryClient,
  user: { id: string; role: string },
): Promise<PermissionMap> {
  if (user.role === "admin") {
    return resolveEffectivePermissions({ userRole: user.role });
  }

  const [roleSettingsResponse, userOverridesResponse] = await Promise.all([
    client.execute({
      sql: `SELECT permission_key, enabled
        FROM role_permission_settings
        WHERE role = ?`,
      args: [user.role],
    }),
    client.execute({
      sql: `SELECT permission_key, enabled
        FROM user_permission_overrides
        WHERE user_id = ?`,
      args: [user.id],
    }),
  ]);

  return resolveEffectivePermissions({
    userRole: user.role,
    roleSettings: rowsToPermissionSettings(roleSettingsResponse.rows),
    userOverrides: rowsToPermissionSettings(userOverridesResponse.rows),
  });
}

export async function getEffectivePermission(
  client: QueryClient,
  user: { id: string; role: string },
  permissionKey: string,
): Promise<boolean> {
  if (!isPermissionKey(permissionKey)) return false;
  if (user.role === "admin") return true;

  const response = await client.execute({
    sql: `SELECT
        (
          SELECT enabled
          FROM user_permission_overrides
          WHERE user_id = ? AND permission_key = ?
        ) AS user_enabled,
        (
          SELECT enabled
          FROM role_permission_settings
          WHERE role = ? AND permission_key = ?
        ) AS role_enabled`,
    args: [user.id, permissionKey, user.role, permissionKey],
  });
  const row = response.rows[0];

  return resolveEffectivePermission(
    {
      userRole: user.role,
      userOverrides:
        row?.user_enabled === null || row?.user_enabled === undefined
          ? undefined
          : { [permissionKey]: Number(row.user_enabled) === 1 },
      roleSettings:
        row?.role_enabled === null || row?.role_enabled === undefined
          ? undefined
          : { [permissionKey]: Number(row.role_enabled) === 1 },
    },
    permissionKey,
  );
}

function isConfigurableRole(role: string): role is ConfigurableRole {
  return CONFIGURABLE_ROLES.some(({ id }) => id === role);
}

export class AccessControlRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404,
  ) {
    super(message);
    this.name = "AccessControlRequestError";
  }
}

async function getAvailablePermissionCatalog(
  client: QueryClient,
): Promise<readonly PermissionDefinition[]> {
  const organizationResponse = await client.execute({
    sql: "SELECT abarca_user_id FROM organization LIMIT 1",
    args: [],
  });
  const hasAiStudies = hasAiStudiesCapability(
    organizationResponse.rows[0]?.abarca_user_id,
  );
  const catalog: readonly PermissionDefinition[] = PERMISSION_CATALOG;

  return catalog.filter(
    ({ requiredCapability }) =>
      requiredCapability === undefined ||
      (requiredCapability === "ai_studies" && hasAiStudies),
  );
}

async function validateUpdateSubjects(
  client: QueryClient,
  updates: readonly AccessControlUpdate[],
): Promise<void> {
  for (const update of updates) {
    if (
      update.subject_type === "role" &&
      !isConfigurableRole(update.subject_id)
    ) {
      throw new AccessControlRequestError(
        update.subject_id === "admin"
          ? "Admin role permissions cannot be changed"
          : `Role ${update.subject_id} is not configurable`,
        400,
      );
    }
  }

  const userIds = [
    ...new Set(
      updates
        .filter((update) => update.subject_type === "user")
        .map((update) => update.subject_id),
    ),
  ];
  if (userIds.length === 0) return;

  const usersResponse = await client.execute({
    sql: `SELECT id, role
      FROM user
      WHERE id IN (${userIds.map(() => "?").join(", ")})`,
    args: userIds,
  });
  const users = new Map(
    usersResponse.rows.map((row) => [String(row.id), String(row.role)]),
  );

  for (const userId of userIds) {
    const role = users.get(userId);
    if (role === undefined) {
      throw new AccessControlRequestError(`User ${userId} not found`, 404);
    }
    if (role === "admin") {
      throw new AccessControlRequestError(
        "Admin user permissions cannot be changed",
        400,
      );
    }
  }
}

async function getAccessControlSnapshotForCatalog(
  client: QueryClient,
  catalog: readonly PermissionDefinition[],
): Promise<AccessControlSnapshot> {
  const availablePermissionKeys = new Set<PermissionKey>(
    catalog.map(({ key }) => key as PermissionKey),
  );
  const roleSettingsResponse = await client.execute({
    sql: `SELECT role, permission_key, enabled
      FROM role_permission_settings
      WHERE role IN (?, ?)
      ORDER BY role, permission_key`,
    args: CONFIGURABLE_ROLES.map(({ id }) => id),
  });
  const userOverridesResponse = await client.execute({
    sql: `SELECT user_id, permission_key, enabled
      FROM user_permission_overrides
      ORDER BY user_id, permission_key`,
    args: [],
  });

  const settingsByRole = new Map<ConfigurableRole, PermissionSettings>(
    CONFIGURABLE_ROLES.map(({ id }) => [id, {}]),
  );
  for (const row of roleSettingsResponse.rows) {
    const role = String(row.role);
    const permissionKey = String(row.permission_key);
    if (
      !isConfigurableRole(role) ||
      !isPermissionKey(permissionKey) ||
      !availablePermissionKeys.has(permissionKey)
    ) {
      continue;
    }
    settingsByRole.get(role)![permissionKey] = Number(row.enabled) === 1;
  }

  const userOverrides: UserPermissionOverride[] = [];
  for (const row of userOverridesResponse.rows) {
    const permissionKey = String(row.permission_key);
    if (
      !isPermissionKey(permissionKey) ||
      !availablePermissionKeys.has(permissionKey)
    ) {
      continue;
    }
    userOverrides.push({
      user_id: String(row.user_id),
      permission_key: permissionKey,
      enabled: Number(row.enabled) === 1,
    });
  }

  return {
    catalog: catalog.map(
      ({
        key,
        group,
        label,
        description,
        defaults,
      }): PublicPermissionDefinition => ({
        key,
        group,
        label,
        description,
        defaults,
      }),
    ),
    roles: CONFIGURABLE_ROLES.map(({ id, label }) => {
      const settings = settingsByRole.get(id)!;
      return {
        id,
        label,
        permissions: Object.fromEntries(
          [...availablePermissionKeys].map((permissionKey) => [
            permissionKey,
            resolveEffectivePermission(
              {
                userRole: id,
                roleSettings: settings,
              },
              permissionKey,
            ),
          ]),
        ),
        settings,
      };
    }),
    user_overrides: userOverrides,
  };
}

export async function getAccessControlSnapshot(
  client: QueryClient,
): Promise<AccessControlSnapshot> {
  const catalog = await getAvailablePermissionCatalog(client);
  return getAccessControlSnapshotForCatalog(client, catalog);
}

export async function updateAccessControl(
  client: TransactionClient,
  updates: readonly AccessControlUpdate[],
): Promise<AccessControlSnapshot> {
  const transaction = await client.transaction("write");
  try {
    const catalog = await getAvailablePermissionCatalog(transaction);
    const availablePermissionKeys = new Set(catalog.map(({ key }) => key));
    if (
      updates.some(
        ({ permission_key }) => !availablePermissionKeys.has(permission_key),
      )
    ) {
      throw new AccessControlRequestError(
        "Permission is not available for this organization",
        400,
      );
    }

    await validateUpdateSubjects(transaction, updates);

    for (const update of updates) {
      const isRole = update.subject_type === "role";
      const table = isRole
        ? "role_permission_settings"
        : "user_permission_overrides";
      const subjectColumn = isRole ? "role" : "user_id";

      if (update.enabled === null) {
        await transaction.execute({
          sql: `DELETE FROM ${table}
            WHERE ${subjectColumn} = ? AND permission_key = ?`,
          args: [update.subject_id, update.permission_key],
        });
        continue;
      }

      await transaction.execute({
        sql: `INSERT INTO ${table} (
            ${subjectColumn},
            permission_key,
            enabled,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(${subjectColumn}, permission_key) DO UPDATE SET
            enabled = excluded.enabled,
            updated_at = CURRENT_TIMESTAMP`,
        args: [
          update.subject_id,
          update.permission_key,
          update.enabled ? 1 : 0,
        ],
      });
    }

    const snapshot = await getAccessControlSnapshotForCatalog(
      transaction,
      catalog,
    );
    await transaction.commit();
    return snapshot;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
