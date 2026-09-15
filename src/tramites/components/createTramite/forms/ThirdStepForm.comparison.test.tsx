import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import type { ComparativaVM } from "@/comparativas/types";
import type { User } from "@/core/types";
import type { TramiteDB } from "@/tramites/types";
import { createEmptyClientDB, createEmptyTramiteDB } from "@/tramites/utils/tramite.factories";
import ThirdStepForm from "./ThirdStepForm";
import ReviewStep from "./ReviewStep";

const mocks = vi.hoisted(() => ({ rules: vi.fn(), calculate: vi.fn() }));
vi.mock("next-view-transitions", () => ({ Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>, useTransitionRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/core/hooks/use-user-company-commissions", () => ({ useUserCompanyCommissions: mocks.rules }));
vi.mock("@/core/utils/sales-commission", () => ({ calculateSalesPersonCommission: mocks.calculate }));
vi.mock("@/comercializadoras/hooks/useActiveEnergySuppliers", () => ({ useActiveEnergySuppliers: () => ({ activeSuppliers: [] }) }));
vi.mock("@/comercializadoras/hooks/useEnergySupplierById", () => ({ useEnergySupplierById: () => ({ supplier: null, loading: false }) }));
vi.mock("@/crm-settings/hooks/useCrmSettings", () => ({ useCrmSettings: () => ({ settings: { providers: [] } }) }));
vi.mock("../ContractPreview", () => ({ default: () => null }));
vi.mock("./ContractForm", () => ({ default: () => null }));
vi.mock("@/core/hooks/use-status-badge", () => ({ getStatusBadge: () => null }));
vi.mock("../InputComponent", () => ({
  InputComponent: ({ label }: { label: string }) => <input aria-label={label} />,
  SelectComponent: ({ label, items, onChange, selectedKey }: { label: string; items: string[]; onChange: (value: string) => void; selectedKey: string }) => <select aria-label={label} value={selectedKey} onChange={(event) => onChange(event.target.value)}>{items.map((item) => <option key={item}>{item}</option>)}</select>,
}));

const user = { id: "owner", name: "Owner", role: "1", organization: { id: "org", name: "Negoco" } } as User;
const comparison: ComparativaVM = { id: "cmp", client: "Client", service: "Luz", plan: ["fijo"], comision: { fijo: 0, indexado: null }, comision_sales_person: { fijo: 0, indexado: null }, has_complete_commissions: { fijo: true, indexado: false }, user, notes: [], creation_date: "2026-09-02", status: "completed", tramite_id: undefined, files: [], has_permanencia: false, has_renovacion: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rules.mockReturnValue({ commissions: [{ commission_value: 99 }] });
  mocks.calculate.mockReturnValue(999);
});

describe("source comparison contract wizard", () => {
  test("source zero remains readonly and can continue without empty-commission modal", () => {
    const submit = vi.fn();
    const setTramite = vi.fn();
    render(<ThirdStepForm comparativa={comparison} tramite={{ ...createEmptyTramiteDB(user, "fijo", comparison), status: "Activo" }} userData={user} setTramite={setTramite} contracts={[]} setContracts={vi.fn()} onBack={vi.fn()} onCancel={vi.fn()} onSubmit={submit} />);
    expect(screen.queryByLabelText("Comisión")).not.toBeInTheDocument();
    expect(screen.getByText("Comisión: 0 €")).toBeInTheDocument();
    expect(screen.getByText("Comisión comercial: 0 €")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(submit).toHaveBeenCalledOnce();
    expect(mocks.calculate).not.toHaveBeenCalled();
    expect(mocks.rules).toHaveBeenCalledWith(undefined);
  });
  test("Baja preview uses the source sign and restores positive amounts when leaving Baja", () => {
    const value = { ...comparison, comision: { fijo: 100, indexado: null }, comision_sales_person: { fijo: 30, indexado: null } };
    const tramite = createEmptyTramiteDB(user, "fijo", value);
    const setTramite = vi.fn();
    render(<ThirdStepForm comparativa={value} tramite={tramite} userData={user} setTramite={setTramite} contracts={[]} setContracts={vi.fn()} onBack={vi.fn()} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "Baja" } });
    const negative = (setTramite.mock.calls[0][0] as (previous: TramiteDB) => TramiteDB)(tramite);
    expect(negative).toMatchObject({ comision: -100, comision_sales_person: -30 });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "Activo" } });
    expect(setTramite.mock.calls[1][0](negative)).toMatchObject({ comision: 100, comision_sales_person: 30 });
  });
  test("final source review displays assigned zero", () => {
    render(<ReviewStep fromComparison tramite={createEmptyTramiteDB(user, "fijo", comparison)} client={createEmptyClientDB(comparison)} contracts={[]} documents={[]} selectedExistingFiles={[]} onSubmit={vi.fn()} onBack={vi.fn()} onCancel={vi.fn()} loading={false} userData={user} />);
    expect(screen.getAllByText(/0,00/).length).toBeGreaterThanOrEqual(2);
  });
});
