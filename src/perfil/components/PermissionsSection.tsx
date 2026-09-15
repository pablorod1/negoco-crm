"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  CircleX,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { z } from "zod";
import type { User } from "@/core/types";
import type {
  AccessControlRoleSnapshot,
  AccessControlSnapshot,
  AccessControlUpdate,
  ConfigurableRole,
  PermissionDefinition,
} from "@/core/access-control/types";
import { showCustomToast } from "@/core/components/CustomToast";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Skeleton } from "@/core/components/ui/skeleton";
import { Switch } from "@/core/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/components/ui/tabs";
import { cn } from "@/core/utils";
import SettingsCard from "@/perfil/components/SettingsCard";

interface Props {
  userData: User;
}

interface AccessControlUser {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "El valor no puede estar vacío.");

const PublicPermissionSchema = z
  .object({
    key: NonEmptyStringSchema,
    group: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    defaults: z
      .object({
        admin: z.boolean(),
        "1": z.boolean(),
        "2": z.boolean(),
      })
      .strict(),
  })
  .strict();

const PermissionValuesSchema = z.record(z.string(), z.boolean());

const AccessControlSnapshotSchema: z.ZodType<AccessControlSnapshot> = z
  .object({
    catalog: z.array(PublicPermissionSchema),
    roles: z.array(
      z
        .object({
          id: z.enum(["1", "2"]),
          label: NonEmptyStringSchema,
          permissions: PermissionValuesSchema,
          settings: PermissionValuesSchema,
        })
        .strict(),
    ),
    user_overrides: z.array(
      z
        .object({
          user_id: NonEmptyStringSchema,
          permission_key: NonEmptyStringSchema,
          enabled: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const catalogKeys = new Set<string>();
    for (const [index, permission] of snapshot.catalog.entries()) {
      if (catalogKeys.has(permission.key)) {
        context.addIssue({
          code: "custom",
          message: `El catálogo contiene la clave duplicada ${permission.key}.`,
          path: ["catalog", index, "key"],
        });
      }
      catalogKeys.add(permission.key);
    }

    const roleIds = new Set(snapshot.roles.map((role) => role.id));
    if (
      snapshot.roles.length !== 2 ||
      roleIds.size !== 2 ||
      !roleIds.has("1") ||
      !roleIds.has("2")
    ) {
      context.addIssue({
        code: "custom",
        message: "El snapshot debe contener exactamente Backoffice y Comercial.",
        path: ["roles"],
      });
    }

    for (const [roleIndex, role] of snapshot.roles.entries()) {
      for (const permissionKey of catalogKeys) {
        if (typeof role.permissions[permissionKey] !== "boolean") {
          context.addIssue({
            code: "custom",
            message: `Falta el permiso efectivo ${permissionKey} para el rol ${role.label}.`,
            path: ["roles", roleIndex, "permissions", permissionKey],
          });
        }
      }

      for (const permissionKey of Object.keys(role.permissions)) {
        if (!catalogKeys.has(permissionKey)) {
          context.addIssue({
            code: "custom",
            message: `El permiso efectivo ${permissionKey} no existe en el catálogo visible.`,
            path: ["roles", roleIndex, "permissions", permissionKey],
          });
        }
      }

      for (const permissionKey of Object.keys(role.settings)) {
        if (!catalogKeys.has(permissionKey)) {
          context.addIssue({
            code: "custom",
            message: `La configuración ${permissionKey} no existe en el catálogo visible.`,
            path: ["roles", roleIndex, "settings", permissionKey],
          });
        }
      }
    }

    const overrideKeys = new Set<string>();
    for (const [overrideIndex, override] of snapshot.user_overrides.entries()) {
      if (!catalogKeys.has(override.permission_key)) {
        context.addIssue({
          code: "custom",
          message: `El override ${override.permission_key} no existe en el catálogo visible.`,
          path: ["user_overrides", overrideIndex, "permission_key"],
        });
      }

      const overrideKey = getOverrideKey(
        override.user_id,
        override.permission_key,
      );
      if (overrideKeys.has(overrideKey)) {
        context.addIssue({
          code: "custom",
          message: "El snapshot contiene un override de usuario duplicado.",
          path: ["user_overrides", overrideIndex],
        });
      }
      overrideKeys.add(overrideKey);
    }
  });

async function readApiResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || fallbackMessage);
  }
  return body.data;
}

function validateAccessControlSnapshot(
  snapshot: unknown,
): AccessControlSnapshot {
  const result = AccessControlSnapshotSchema.safeParse(snapshot);
  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ??
        "La configuración de permisos no es válida.",
    );
  }
  return result.data;
}

function getEffectiveRolePermission(
  role: AccessControlRoleSnapshot,
  permissionKey: string,
): boolean {
  const enabled = role.permissions[permissionKey];
  if (typeof enabled !== "boolean") {
    throw new Error(
      `Falta el permiso efectivo ${permissionKey} para el rol ${role.label}.`,
    );
  }
  return enabled;
}

function getRoleDraftKey(roleId: string, permissionKey: string) {
  return `${roleId}:${permissionKey}`;
}

function getOverrideKey(userId: string, permissionKey: string) {
  return JSON.stringify([userId, permissionKey]);
}

function rebaseRoleDraft(
  draft: ReadonlyMap<string, boolean>,
  snapshot: AccessControlSnapshot,
): Map<string, boolean> {
  const next = new Map(draft);
  const catalogKeys = new Set(
    snapshot.catalog.map((permission) => permission.key),
  );

  for (const [draftKey, enabled] of draft) {
    const separatorIndex = draftKey.indexOf(":");
    if (separatorIndex <= 0) {
      throw new Error(`La clave de borrador ${draftKey} no es válida.`);
    }

    const roleId = draftKey.slice(0, separatorIndex);
    const permissionKey = draftKey.slice(separatorIndex + 1);
    const role = snapshot.roles.find((candidate) => candidate.id === roleId);
    if (
      !catalogKeys.has(permissionKey) ||
      (role && role.permissions[permissionKey] === enabled)
    ) {
      next.delete(draftKey);
    }
  }

  return next;
}

function rebaseUserDraft(
  draft: ReadonlyMap<string, boolean | null>,
  snapshot: AccessControlSnapshot,
  selectedUserId: string | null,
  selectedRoleId: ConfigurableRole | null,
): Map<string, boolean | null> {
  if (!selectedUserId || !selectedRoleId) return new Map(draft);

  const next = new Map(draft);
  const role = snapshot.roles.find(
    (candidate) => candidate.id === selectedRoleId,
  );
  if (!role) return next;

  const catalogKeys = new Set(
    snapshot.catalog.map((permission) => permission.key),
  );
  const overrides = new Map(
    snapshot.user_overrides
      .filter((override) => override.user_id === selectedUserId)
      .map((override) => [override.permission_key, override.enabled]),
  );

  for (const [permissionKey, desiredValue] of draft) {
    if (!catalogKeys.has(permissionKey)) {
      next.delete(permissionKey);
      continue;
    }

    const hasOverride = overrides.has(permissionKey);
    if (desiredValue === null) {
      if (!hasOverride) next.delete(permissionKey);
      continue;
    }

    const effectiveValue = hasOverride
      ? overrides.get(permissionKey)
      : role.permissions[permissionKey];
    if (effectiveValue === desiredValue) {
      next.delete(permissionKey);
    }
  }

  return next;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function ChangeFooter({
  hasChanges,
  saving,
  label,
  onSave,
}: {
  hasChanges: boolean;
  saving: boolean;
  label: string;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <span
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-gray-500"
      >
        <span
          className={cn(
            "size-2 rounded-full",
            hasChanges ? "bg-orange-400" : "bg-green-400",
          )}
        />
        {hasChanges ? "Tienes cambios sin guardar" : "Todo actualizado"}
      </span>
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={!hasChanges || saving}
        aria-label={
          saving ? `${label.replace(/^Guardar/, "Guardando")}…` : label
        }
        className="w-full rounded-xl bg-gray-900 px-6 text-white hover:bg-gray-800 sm:w-auto"
      >
        <Save className="size-4" />
        {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}

export default function PermissionsSection({ userData }: Props) {
  const requestGenerationRef = useRef(0);
  const patchControllerRef = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<AccessControlSnapshot | null>(null);
  const [users, setUsers] = useState<AccessControlUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("roles");
  const [roleDraft, setRoleDraft] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState<
    Map<string, boolean | null>
  >(() => new Map());
  const [query, setQuery] = useState("");

  useEffect(() => {
    const generation = ++requestGenerationRef.current;
    const controller = new AbortController();
    patchControllerRef.current?.abort();
    patchControllerRef.current = null;

    async function loadPermissions() {
      setSnapshot(null);
      setUsers([]);
      setLoading(true);
      setLoadError(null);
      setSaving(false);
      setRoleDraft(new Map());
      setSelectedUserId(null);
      setUserDraft(new Map());
      setQuery("");

      try {
        const [accessResponse, usersResponse] = await Promise.all([
          fetch("/api/v2/access-control", { signal: controller.signal }),
          fetch(
            `/api/v2/users/${encodeURIComponent(userData.id)}/all?role=${encodeURIComponent(userData.role)}`,
            { signal: controller.signal },
          ),
        ]);
        const [accessPayload, usersData] = await Promise.all([
          readApiResponse<unknown>(
            accessResponse,
            "No se pudieron cargar los permisos.",
          ),
          readApiResponse<AccessControlUser[]>(
            usersResponse,
            "No se pudieron cargar los usuarios.",
          ),
        ]);
        if (
          controller.signal.aborted ||
          requestGenerationRef.current !== generation
        ) {
          return;
        }

        const accessData = validateAccessControlSnapshot(accessPayload);
        setSnapshot(accessData);
        const configurableRoleIds = new Set<string>(
          accessData.roles.map((role) => role.id),
        );
        setUsers(
          usersData.filter((user) => configurableRoleIds.has(user.role)),
        );
      } catch (error) {
        if (
          !isAbortError(error) &&
          !controller.signal.aborted &&
          requestGenerationRef.current === generation
        ) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la configuración de permisos.",
          );
        }
      } finally {
        if (
          !controller.signal.aborted &&
          requestGenerationRef.current === generation
        ) {
          setLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      controller.abort();
      patchControllerRef.current?.abort();
      patchControllerRef.current = null;
      if (requestGenerationRef.current === generation) {
        requestGenerationRef.current += 1;
      }
    };
  }, [userData.id, userData.role]);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    for (const permission of snapshot?.catalog ?? []) {
      const permissions = groups.get(permission.group);
      if (permissions) {
        permissions.push(permission);
      } else {
        groups.set(permission.group, [permission]);
      }
    }
    return [...groups.entries()];
  }, [snapshot]);

  const rolesById = useMemo(
    () => new Map(snapshot?.roles.map((role) => [role.id, role]) ?? []),
    [snapshot],
  );
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const overridesBySubject = useMemo(
    () =>
      new Map(
        snapshot?.user_overrides.map((override) => [
          getOverrideKey(override.user_id, override.permission_key),
          override,
        ]) ?? [],
      ),
    [snapshot],
  );
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    if (!normalizedQuery) return users;

    return users.filter((user) =>
      `${user.name} ${user.email}`.toLocaleLowerCase("es").includes(normalizedQuery),
    );
  }, [query, users]);
  const selectedUser = selectedUserId
    ? usersById.get(selectedUserId) ?? null
    : null;
  const selectedRole =
    selectedUser?.role === "1" || selectedUser?.role === "2"
      ? rolesById.get(selectedUser.role)
      : undefined;

  const applyReturnedSnapshot = (nextSnapshot: AccessControlSnapshot) => {
    setSnapshot(nextSnapshot);
    setRoleDraft((current) => rebaseRoleDraft(current, nextSnapshot));
    setUserDraft((current) =>
      rebaseUserDraft(
        current,
        nextSnapshot,
        selectedUser?.id ?? null,
        selectedRole?.id ?? null,
      ),
    );
  };

  const stageRolePermission = (
    roleId: ConfigurableRole,
    permissionKey: string,
    enabled: boolean,
  ) => {
    if (saving) return;
    const role = rolesById.get(roleId);
    if (!role) {
      throw new Error(`No existe el rol configurable ${roleId}.`);
    }
    const persistedValue = getEffectiveRolePermission(role, permissionKey);

    setRoleDraft((current) => {
      const next = new Map(current);
      const key = getRoleDraftKey(roleId, permissionKey);
      if (enabled === persistedValue) {
        next.delete(key);
      } else {
        next.set(key, enabled);
      }
      return next;
    });
  };

  const selectUser = (userId: string) => {
    if (saving || userId === selectedUserId) return;
    setSelectedUserId(userId);
    setUserDraft(new Map());
  };

  const stageUserPermission = (
    permissionKey: string,
    enabled: boolean,
  ) => {
    if (saving || !selectedUser || !selectedRole) return;

    const roleValue = getEffectiveRolePermission(
      selectedRole,
      permissionKey,
    );
    const storedOverride = overridesBySubject.get(
      getOverrideKey(selectedUser.id, permissionKey),
    );
    const initialValue = storedOverride?.enabled ?? roleValue;

    setUserDraft((current) => {
      const next = new Map(current);
      if (enabled === initialValue) {
        next.delete(permissionKey);
      } else if (enabled === roleValue) {
        next.set(permissionKey, null);
      } else {
        next.set(permissionKey, enabled);
      }
      return next;
    });
  };

  const resetUserPermission = (permissionKey: string) => {
    if (saving || !selectedUser) return;
    const storedOverride = overridesBySubject.get(
      getOverrideKey(selectedUser.id, permissionKey),
    );

    setUserDraft((current) => {
      const next = new Map(current);
      if (storedOverride) {
        next.set(permissionKey, null);
      } else {
        next.delete(permissionKey);
      }
      return next;
    });
  };

  const saveUpdates = async (
    updates: AccessControlUpdate[],
    successTitle: string,
    successMessage: string,
  ) => {
    const generation = requestGenerationRef.current;
    const controller = new AbortController();
    patchControllerRef.current?.abort();
    patchControllerRef.current = controller;
    setSaving(true);

    try {
      const response = await fetch("/api/v2/access-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
        signal: controller.signal,
      });
      const nextPayload = await readApiResponse<unknown>(
        response,
        "No se pudieron guardar los permisos.",
      );
      if (
        controller.signal.aborted ||
        requestGenerationRef.current !== generation
      ) {
        return false;
      }

      const nextSnapshot = validateAccessControlSnapshot(nextPayload);
      applyReturnedSnapshot(nextSnapshot);
      showCustomToast({
        title: successTitle,
        message: successMessage,
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
      return true;
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        requestGenerationRef.current !== generation
      ) {
        return false;
      }

      showCustomToast({
        title: "Error al guardar",
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar los permisos.",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return false;
    } finally {
      if (patchControllerRef.current === controller) {
        patchControllerRef.current = null;
      }
      if (
        !controller.signal.aborted &&
        requestGenerationRef.current === generation
      ) {
        setSaving(false);
      }
    }
  };

  const saveRoleChanges = async () => {
    const updates: AccessControlUpdate[] = [...roleDraft].map(
      ([subjectKey, enabled]) => {
        const separatorIndex = subjectKey.indexOf(":");
        return {
          subject_type: "role",
          subject_id: subjectKey.slice(0, separatorIndex),
          permission_key: subjectKey.slice(separatorIndex + 1),
          enabled,
        };
      },
    );
    if (updates.length === 0) return;

    await saveUpdates(
      updates,
      "Permisos por rol guardados",
      "Los permisos efectivos de los roles se han actualizado.",
    );
  };

  const saveUserChanges = async () => {
    if (!selectedUser || userDraft.size === 0) return;

    const updates: AccessControlUpdate[] = [...userDraft].map(
      ([permissionKey, enabled]) => ({
        subject_type: "user",
        subject_id: selectedUser.id,
        permission_key: permissionKey,
        enabled,
      }),
    );
    await saveUpdates(
      updates,
      "Permisos del usuario guardados",
      `La configuración de ${selectedUser.name} se ha actualizado.`,
    );
  };

  if (loading) {
    return (
      <SettingsCard
        title="Permisos"
        description="Controla el acceso a funciones sensibles del CRM."
        icon={<ShieldCheck className="size-5" />}
        bodyClassName="space-y-4"
      >
        <div aria-busy="true" className="space-y-4">
          <p className="text-sm font-medium text-gray-600">
            Cargando permisos…
          </p>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </SettingsCard>
    );
  }

  if (loadError || !snapshot) {
    return (
      <SettingsCard
        title="Permisos"
        description="Controla el acceso a funciones sensibles del CRM."
        icon={<ShieldCheck className="size-5" />}
      >
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            No se pudo cargar la configuración
          </p>
          <p className="mt-1 text-sm text-red-700">{loadError}</p>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Permisos"
      description="Define quién puede iniciar y revisar procesos protegidos."
      icon={<ShieldCheck className="size-5" />}
      action={
        <Badge variant="secondary" className="whitespace-nowrap">
          {snapshot.catalog.length} permisos
        </Badge>
      }
      bodyClassName="space-y-5"
    >
      <div className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50/70 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-600" />
        <div>
          <p className="text-sm font-semibold text-primary-900">
            Dirección siempre tiene acceso
          </p>
          <p className="mt-0.5 text-sm leading-5 text-primary-700">
            Los permisos de Dirección no se pueden desactivar. Aquí puedes
            configurar Backoffice, Comercial y excepciones individuales.
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        aria-busy={saving}
      >
        <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-gray-100 p-1">
          <TabsTrigger
            value="roles"
            onClick={() => setActiveTab("roles")}
            disabled={saving}
            className="h-9 rounded-lg"
          >
            Por rol
          </TabsTrigger>
          <TabsTrigger
            value="users"
            onClick={() => setActiveTab("users")}
            disabled={saving}
            className="h-9 rounded-lg"
          >
            Por usuario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-5 space-y-6">
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[minmax(300px,1fr)_130px_130px] items-center border-b border-gray-200 bg-gray-50 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Permiso
                </span>
                {snapshot.roles.map((role) => (
                  <span
                    key={role.id}
                    className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {role.label}
                  </span>
                ))}
              </div>

              {permissionGroups.map(([group, permissions]) => (
                <section key={group} aria-labelledby={`permission-group-${group}`}>
                  <h4
                    id={`permission-group-${group}`}
                    className="border-b border-gray-100 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                  >
                    {group}
                  </h4>
                  {permissions.map((permission) => {
                    const permissionKey = permission.key;
                    return (
                      <div
                        key={permission.key}
                        data-permission-row
                        className="grid grid-cols-[minmax(300px,1fr)_130px_130px] items-center border-b border-gray-100 px-4 py-4 last:border-b-0"
                      >
                        <div className="pr-6">
                          <p className="text-sm font-medium text-gray-900">
                            {permission.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            {permission.description}
                          </p>
                        </div>
                        {snapshot.roles.map((role) => {
                          const draftKey = getRoleDraftKey(
                            role.id,
                            permission.key,
                          );
                          const checked = roleDraft.has(draftKey)
                            ? (roleDraft.get(draftKey) as boolean)
                            : getEffectiveRolePermission(role, permissionKey);

                          return (
                            <div key={role.id} className="flex justify-center">
                              <Switch
                                checked={checked}
                                disabled={saving}
                                onCheckedChange={(enabled) =>
                                  stageRolePermission(
                                    role.id,
                                    permissionKey,
                                    enabled,
                                  )
                                }
                                aria-label={`${permission.label} para ${role.label}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>

          <ChangeFooter
            hasChanges={roleDraft.size > 0}
            saving={saving}
            label="Guardar cambios de rol"
            onSave={saveRoleChanges}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.55fr)]">
            <aside className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  disabled={saving}
                  aria-label="Buscar usuario"
                  placeholder="Buscar por nombre o email"
                  className="h-10 rounded-xl pl-9"
                />
              </div>
              <div className="max-h-[420px] space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 p-2">
                {filteredUsers.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-gray-500">
                    No hay usuarios que coincidan.
                  </p>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUser(user.id)}
                      disabled={saving}
                      aria-pressed={selectedUserId === user.id}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        selectedUserId === user.id
                          ? "bg-primary-50 text-primary-900"
                          : "hover:bg-gray-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          selectedUserId === user.id
                            ? "bg-primary-100 text-primary-700"
                            : "bg-gray-100 text-gray-500",
                        )}
                      >
                        <UserRound className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {user.email}
                        </span>
                      </span>
                      {user.banned ? (
                        <Badge variant="danger" className="shrink-0 px-2">
                          Inactivo
                        </Badge>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs leading-5 text-gray-500">
                Si cambias de usuario, se descartarán los cambios que no hayas
                guardado.
              </p>
            </aside>

            <div className="min-w-0">
              {!selectedUser || !selectedRole ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/70 px-6 text-center">
                  <UserRound className="size-8 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-700">
                    Selecciona un usuario
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-gray-500">
                    Verás sus permisos efectivos y podrás personalizar
                    excepciones respecto a su rol.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {selectedUser.name}
                        </h4>
                        <Badge variant="secondary">{selectedRole.label}</Badge>
                        {selectedUser.banned ? (
                          <Badge variant="danger">Inactivo</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {selectedUser.email}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    {permissionGroups.map(([group, permissions]) => (
                      <section
                        key={group}
                        aria-labelledby={`user-permission-group-${group}`}
                      >
                        <h4
                          id={`user-permission-group-${group}`}
                          className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900"
                        >
                          {group}
                        </h4>
                        {permissions.map((permission) => {
                          const permissionKey = permission.key;
                          const roleValue = getEffectiveRolePermission(
                            selectedRole,
                            permissionKey,
                          );
                          const storedOverride = overridesBySubject.get(
                            getOverrideKey(selectedUser.id, permission.key),
                          );
                          const hasDraft = userDraft.has(permissionKey);
                          const draftValue = userDraft.get(permissionKey);
                          const isCustomized = hasDraft
                            ? draftValue !== null
                            : Boolean(storedOverride);
                          const effectiveValue = hasDraft
                            ? draftValue === null
                              ? roleValue
                              : (draftValue as boolean)
                            : (storedOverride?.enabled ?? roleValue);

                          return (
                            <div
                              key={permission.key}
                              data-permission-row
                              className="border-b border-gray-100 p-4 last:border-b-0"
                            >
                              <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900">
                                      {permission.label}
                                    </p>
                                    {isCustomized ? (
                                      <Badge variant="info">Personalizado</Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-gray-500">
                                    {permission.description}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <span className="text-xs font-medium text-gray-500">
                                      Rol:{" "}
                                      {roleValue
                                        ? "Habilitado"
                                        : "Deshabilitado"}
                                    </span>
                                    {isCustomized ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={saving}
                                        onClick={() =>
                                          resetUserPermission(permissionKey)
                                        }
                                        aria-label={`Restablecer ${permission.label} al rol`}
                                        className="h-7 rounded-lg px-2 text-xs text-primary-700"
                                      >
                                        <RotateCcw className="size-3.5" />
                                        Restablecer al rol
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                                <Switch
                                  checked={effectiveValue}
                                  disabled={saving}
                                  onCheckedChange={(enabled) =>
                                    stageUserPermission(
                                      permissionKey,
                                      enabled,
                                    )
                                  }
                                  aria-label={`${permission.label} para ${selectedUser.name}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    ))}
                  </div>

                  <ChangeFooter
                    hasChanges={userDraft.size > 0}
                    saving={saving}
                    label="Guardar cambios de usuario"
                    onSave={saveUserChanges}
                  />
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </SettingsCard>
  );
}
