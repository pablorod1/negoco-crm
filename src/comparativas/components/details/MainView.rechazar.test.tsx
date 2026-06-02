import { describe, expect, test, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import MainView from "./MainView";

mock.module("@/comercializadoras/hooks/useEnergySupplierById", () => ({
  useEnergySupplierById: () => ({ supplier: null, loading: false }),
}));
mock.module("@/core/view-transitions/useGenieEffect", () => ({
  useSidebarSlideNavigation: () => () => {},
}));
mock.module("@/core/contexts/UserContext", () => ({
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
  test("shows 'Rechazar Cliente' action when status is completed", () => {
    render(
      <MainView
        comparativa={baseComparativa as never}
        userData={userData as never}
        onUpdate={() => {}}
        isSubcomercial={false}
        isEditable
        isComercialEditable={false}
        isProcessed={false}
      />,
    );
    expect(screen.getByRole("button", { name: /Rechazar Cliente/i })).toBeDefined();
  });
});
