import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import type { ComparativaVM } from "@/comparativas/types";
import type { User } from "@/core/types";
import CompletarEstudioModal from "./CompletarEstudioModal";

const mocks = vi.hoisted(() => ({ rules: vi.fn(), calculate: vi.fn(), suppliers: vi.fn() }));
vi.mock("@/core/hooks/use-user-company-commissions", () => ({ useUserCompanyCommissions: mocks.rules }));
vi.mock("@/core/utils/sales-commission", () => ({ calculateSalesPersonCommission: mocks.calculate }));
vi.mock("@/comercializadoras/hooks/useActiveEnergySuppliers", () => ({ useActiveEnergySuppliers: mocks.suppliers }));
vi.mock("@/core/components/CustomToast", () => ({ showCustomToast: vi.fn() }));
vi.mock("@/core/firebase/data/uploadFiles", () => ({ uploadFile: vi.fn() }));
vi.mock("@/tramites/components/DocumentsForm", () => ({ default: () => null }));
vi.mock("@/core/components/LoadingStateModal", () => ({ default: () => null }));
vi.mock("@/core/utils/notifications.helpers", () => ({ generateComparativaUpdatedNotification: () => ({}) }));
vi.mock("@/core/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: Wrapper, DialogContent: Wrapper, DialogHeader: Wrapper, DialogFooter: Wrapper, DialogTrigger: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper };
});
vi.mock("./ComissionsForm", () => ({ default: ({ formDataComissions }: { formDataComissions: Record<string, number | null> }) => <div>{Object.entries(formDataComissions).map(([field, value]) => <input key={field} aria-label={field} value={value ?? ""} readOnly />)}</div> }));

const user = { id: "actor", role: "1", name: "Actor", organization: { id: "org", name: "Negoco" } } as User;
const comparison: ComparativaVM = { id: "cmp", client: "Client", service: "Luz", plan: ["fijo"], comision: { fijo: 100, indexado: null }, comision_sales_person: { fijo: 37, indexado: null }, company_id: "supplier", notes: [], user: { id: "owner", name: "Sales" }, creation_date: "2026-09-02", status: "awaiting_review", tramite_id: undefined, files: [], has_permanencia: false, has_renovacion: false };

const props = { userData: user, mode: "ai_review" as const, canCompleteStudies: true, canReviewStudies: true, onUpdate: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rules.mockReturnValue({ commissions: [] });
  mocks.suppliers.mockReturnValue({ activeSuppliers: [{ id: "supplier", name: "Supplier" }] });
  mocks.calculate.mockReturnValue(999);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
});

describe("AI study review values", () => {
  test("does not pick an ambiguous supplier prefix and prefers the persisted supplier", () => {
    mocks.suppliers.mockReturnValue({ activeSuppliers: [{ id: "one", name: "Supplier" }, { id: "two", name: "SUPPLIER" }, { id: "supplier", name: "Saved" }] });
    const value = { ...comparison, company_id: undefined, abarca_estudio: { empresa: "Supplier - Plan" } as ComparativaVM["abarca_estudio"] };
    const view = render(<CompletarEstudioModal {...props} comparativa={value} />);
    expect(screen.getByRole("button", { name: "Completar Revisión" })).toBeDisabled();
    view.rerender(<CompletarEstudioModal {...props} comparativa={{ ...value, company_id: "supplier" }} />);
    expect(screen.getByRole("button", { name: "Completar Revisión" })).toBeEnabled();
  });
  test.each([37, 0, null, 58])("opening preserves stored decision %s despite arriving rule data", (sales) => {
    const value = { ...comparison, comision_sales_person: { fijo: sales, indexado: null } };
    const view = render(<CompletarEstudioModal {...props} comparativa={comparison} />);
    view.rerender(<CompletarEstudioModal {...props} comparativa={value} />);
    fireEvent.click(screen.getByRole("button", { name: "Asignar Comercializadora y Comisiones" }));
    expect(screen.getByLabelText("comision_sales_person_fijo")).toHaveValue(sales === null ? "" : String(sales));
    mocks.rules.mockReturnValue({ commissions: [{ commission_value: 99 }] });
    view.rerender(<CompletarEstudioModal {...props} comparativa={value} />);
    expect(screen.getByLabelText("comision_sales_person_fijo")).toHaveValue(sales === null ? "" : String(sales));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Asignar Comercializadora y Comisiones" }));
    expect(screen.getByLabelText("comision_sales_person_fijo")).toHaveValue(sales === null ? "" : String(sales));
    expect(mocks.calculate).not.toHaveBeenCalled();
  });

  test("role2 sees only sales readonly and submits no commission payload", async () => {
    render(<CompletarEstudioModal {...props} userData={{ ...user, role: "2" }} comparativa={{ ...comparison, comision: { fijo: null, indexado: null }, has_complete_commissions: { fijo: true, indexado: false } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Asignar Comercializadora y Comisiones" }));
    expect(screen.queryByLabelText("comision_fijo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("comision_sales_person_fijo")).not.toBeInTheDocument();
    expect(screen.getByText("Comisión comercial fijo: 37 €")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Completar Revisión" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/status"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: "completed", company_id: "supplier" });
    expect(mocks.rules).toHaveBeenCalledWith(undefined);
  });

  test("pending decision hides completion and leaves the result action to its parent", () => {
    render(<CompletarEstudioModal {...props} comparativa={{ ...comparison, has_pending_study_result: true }} />);
    expect(screen.queryByText(/en la parte superior de la ficha/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Completar Revisión" })).not.toBeInTheDocument();
  });
});
