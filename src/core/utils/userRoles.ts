import { User } from "@/core/types";

export type UserRole = "1" | "2" | "admin";

export interface RolePermissions {
  isBackOffice: boolean;
  isComercial: boolean;
  isDireccion: boolean;
}

export const getUserRolePermissions = (
  userData: User | null
): RolePermissions => {
  if (!userData) {
    return {
      isBackOffice: false,
      isComercial: false,
      isDireccion: false,
    };
  }

  return {
    isBackOffice: userData.role === "1",
    isComercial: userData.role === "2",
    isDireccion: userData.role === "admin",
  };
};

export const getRoleComponent = (permissions: RolePermissions) => {
  if (permissions.isComercial) return "comercial";
  if (permissions.isBackOffice) return "backoffice";
  if (permissions.isDireccion) return "direccion";
  return null;
};
