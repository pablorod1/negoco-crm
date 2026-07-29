import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { User } from "@/core/types";
import SettingsShell from "./SettingsShell";

vi.mock("@/core/components/AvatarComponent", () => ({
  default: () => <div aria-hidden="true" />,
}));
vi.mock("@/crm-settings/hooks/useCrmSettings", () => ({
  useCrmSettings: () => ({
    settings: null,
    loading: false,
    error: null,
    saveSettings: vi.fn(),
  }),
}));
vi.mock("@/perfil/hooks/useSignOut", () => ({
  useSignOut: () => ({ signOut: vi.fn(), signingOut: false }),
}));
vi.mock("@/perfil/components/ProfileSection", () => ({
  default: () => <div>Contenido de perfil</div>,
}));
vi.mock("@/perfil/components/SecuritySection", () => ({
  default: () => <div>Contenido de seguridad</div>,
}));
vi.mock("@/crm-settings/components/ProvidersSettings", () => ({
  default: () => <div>Contenido de proveedores</div>,
}));
vi.mock("@/crm-settings/components/AutoActivationSettings", () => ({
  default: () => <div>Contenido de activación</div>,
}));
vi.mock("@/perfil/components/PermissionsSection", () => ({
  default: () => <h2>Administrar permisos</h2>,
}));

describe("SettingsShell permissions navigation", () => {
  test("shows the Administration group and opens Permissions", () => {
    const userData = {
      id: "admin-1",
      name: "Dirección",
      email: "direccion@example.com",
      role: "admin",
      organization: { id: "organization-1", name: "Negoco" },
    } as User;

    render(
      <SettingsShell userData={userData} refreshUserData={vi.fn()} />,
    );

    expect(screen.getByText("Administración")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Permisos" }));

    expect(
      screen.getByRole("heading", { name: "Administrar permisos" }),
    ).toBeInTheDocument();
  });

  test.each([
    ["Backoffice", "1"],
    ["Comercial", "2"],
  ])("hides Administration and Permissions for %s", (name, role) => {
    const userData = {
      id: `user-${role}`,
      name,
      email: `${role}@example.com`,
      role,
      organization: { id: "organization-1", name: "Negoco" },
    } as User;

    render(
      <SettingsShell userData={userData} refreshUserData={vi.fn()} />,
    );

    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Permisos" }),
    ).not.toBeInTheDocument();
  });
});
