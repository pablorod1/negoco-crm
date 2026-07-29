import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import UpdateComparativaStatusModal from "./UpdateComparativaStatusModal";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  onUpdate: vi.fn(),
  showCustomToast: vi.fn(),
}));

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: mocks.showCustomToast,
}));
vi.mock("@/comercializadoras/hooks/useActiveEnergySuppliers", () => ({
  useActiveEnergySuppliers: () => ({ activeSuppliers: [] }),
}));
vi.mock("@/core/hooks/use-user-company-commissions", () => ({
  useUserCompanyCommissions: () => ({ commissions: [] }),
}));
vi.mock("./ComissionsForm", () => ({
  default: () => <div>Formulario de comisiones</div>,
}));
vi.mock("@/core/components/LoadingStateModal", () => ({
  default: () => <div>Cargando</div>,
}));
vi.mock("@/core/utils/notifications.helpers", () => ({
  generateComparativaUpdatedNotification: () => ({
    id: "comparison-1",
    title: "Actualizada",
    message: "Actualizada",
    created_at: "2026-01-01",
    context: "Comparativas",
    link: "comparison-1",
    priority: 3,
  }),
}));
vi.mock("@/tramites/components/createTramite/InputComponent", () => ({
  SelectComponent: ({
    label,
    selectedKey,
    onChange,
    items,
    disabled,
  }: {
    label: string;
    selectedKey: string;
    onChange: (value: string) => void;
    items: { value: string; label: string }[];
    disabled?: boolean;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={selectedKey}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value={selectedKey}>{selectedKey}</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));
vi.mock("@/core/components/ui/dialog", async () => {
  const ReactModule = await import("react");
  const DialogContext = ReactModule.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>({ open: false, onOpenChange: () => {} });

  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>
        {children}
      </DialogContext.Provider>
    ),
    DialogTrigger: ({ children }: { children: React.ReactElement }) => {
      const context = ReactModule.useContext(DialogContext);
      return ReactModule.cloneElement(children, {
        onClick: () => context.onOpenChange(true),
      } as React.HTMLAttributes<HTMLElement>);
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => {
      const context = ReactModule.useContext(DialogContext);
      if (!context.open) return null;
      return (
        <div
          role="dialog"
          onKeyDown={(event) => {
            if (event.key === "Escape") context.onOpenChange(false);
          }}
        >
          {children}
        </div>
      );
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DialogFooter: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
  };
});

const comparativa = {
  id: "comparison-1",
  client: "ACME",
  service: "Luz",
  plan: ["fijo"],
  status: "rejected",
  tramite_id: "tramite-existing",
  comision: { fijo: 0, indexado: 0 },
  comision_sales_person: { fijo: 0, indexado: 0 },
  notes: [],
  files: [],
  creation_date: "2026-01-01",
  company_id: "supplier-1",
  company_name: "Supplier",
  user: {
    id: "owner-1",
    name: "Ana",
    email: "ana@example.com",
    role: "2",
    organization: { id: "organization-1", name: "Tenant" },
  },
};

const userData = {
  id: "admin-1",
  role: "1",
  permissions: {
    "comparisons.study.complete": true,
    "comparisons.study.review": true,
  },
  organization: {
    id: "organization-1",
    name: "Tenant",
    logo: null,
  },
};

function renderModal() {
  render(
    <UpdateComparativaStatusModal
      comparativa={comparativa as never}
      onUpdate={mocks.onUpdate}
      userData={userData as never}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("UpdateComparativaStatusModal integration", () => {
  test("does not submit the current state and closes with Escape", () => {
    renderModal();

    expect(
      screen.getAllByRole("button", { name: "Actualizar" })[1],
    ).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("accepts zero commissions, omits tramite_id and refreshes after the committed PATCH", async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, error: "notification failed" }),
          { status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, error: "email failed" }),
          {
            status: 500,
          },
        ),
      );
    renderModal();

    fireEvent.change(screen.getByRole("combobox", { name: "Estado" }), {
      target: { value: "completed" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Actualizar" })[1]);

    await waitFor(() => expect(mocks.onUpdate).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const [statusUrl, statusInit] = mocks.fetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(statusUrl).toBe("/api/v2/comparisons/comparison-1/status");
    expect(statusInit.method).toBe("PATCH");
    expect(JSON.parse(String(statusInit.body))).toEqual({
      status: "completed",
    });

    await waitFor(() =>
      expect(mocks.showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Estado actualizado",
          message:
            "El estado se actualizó, pero no se pudieron enviar todos los avisos.",
        }),
      ),
    );
  });
});
