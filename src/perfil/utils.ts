import type { UserRole } from "@/core/utils/userRoles";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  "1": "Backoffice",
  "2": "Comercial",
};

export function getRoleLabel(role: string): string {
  return roleLabels[role] ?? "Usuario";
}

export function isAdminRole(role: string): role is Extract<UserRole, "admin"> {
  return role === "admin";
}
