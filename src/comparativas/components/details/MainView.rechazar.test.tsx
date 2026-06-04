import { describe, expect, test, vi } from "vitest";
import type React from "react";
import { render, screen } from "@testing-library/react";
import MainView from "./MainView";

vi.mock("@/comercializadoras/hooks/useEnergySupplierById", () => ({
  useEnergySupplierById: () => ({ supplier: null, loading: false }),
}));
vi.mock("@/core/view-transitions/useGenieEffect", () => ({
  useSidebarSlideNavigation: () => () => {},
}));
vi.mock("next-view-transitions", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useTransitionRouter: () => ({ push: () => {} }),
}));
vi.mock("@/core/contexts/UserContext", () => ({
  useUser: () => ({
    userData: { id: "u1", role: "admin", organization: { id: "o1" } },
    loading: false,
    refreshUserData: () => Promise.resolve(),
    getPlan: () => null,
    showReauthModal: false,
    setShowReauthModal: () => {},
  }),
}));

const baseComparativa = {
  id: "c1",
  client: "ACME",
  service: "Luz",
  plan: ["fijo"],
  comision: { fijo: 0, indexado: 0 },
  comision_sales_person: { fijo: 0, indexado: 0 },
  notes: [],
  user: { name: "Ana", email: "ana@x.com", role: "2" },
  creation_date: "2026-01-01",
  status: "completed",
  tramite_id: undefined,
  files: [],
  organization: { id: "o1", abarca_user_id: null },
};

const userData = {
  id: "u1",
  role: "admin",
  organization: { id: "o1", abarca_user_id: null },
};

describe("MainView rechazar cliente", () => {
  test.each([
    ["admin"],
    ["2"],
  ])("shows Rechazar Cliente action for role %s", (role) => {
    render(
      <MainView
        comparativa={baseComparativa as never}
        userData={{ ...userData, role } as never}
        onUpdate={() => {}}
        isSubcomercial={false}
        isEditable
        isComercialEditable={false}
        isProcessed={false}
      />,
    );

    const button = screen.getByRole("button", { name: /Rechazar Cliente/i });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Rechazar Cliente");
  });
});
