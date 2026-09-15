import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ComparativaVM } from "@/comparativas/types";
import type { User } from "@/core/types";
import { createEmptyTramiteDB } from "@/tramites/utils/tramite.factories";
import ComparativaToTramiteStep from "./ComparativaToTramiteStep";
import type { AnchorHTMLAttributes } from "react";

vi.mock("next-view-transitions", () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
  useTransitionRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/comercializadoras/hooks/useEnergySupplierById", () => ({
  useEnergySupplierById: () => ({ supplier: { name: "Supplier" } }),
}));
vi.mock("../InputComponent", () => ({
  SelectComponent: ({ items, selectedKey, onChange }: {
    items: string[];
    selectedKey: string;
    onChange: (value: string) => void;
  }) => <select aria-label="Plan" value={selectedKey} onChange={(event) => onChange(event.target.value)}>
    {items.map((item) => <option key={item} value={item}>{item}</option>)}
  </select>,
}));

const user: User = {
  id: "user-1", name: "Admin", email: "admin@example.com", email_verified: true,
  created_at: "2026-09-02", updated_at: "2026-09-02", banned: false, image: null,
  organization: { id: "org", name: "Negoco", logo: null, plan: null },
  company: null, role: "1", super_id: null,
  should_reset_password: false, has_abarca_user_id: false,
};
const comparison: ComparativaVM = {
  id: "comparison-1", client: "Client", service: "Luz", plan: ["fijo"],
  comision: { fijo: 0, indexado: 100 },
  comision_sales_person: { fijo: 0, indexado: 50 },
  notes: [], user, creation_date: "2026-09-02", status: "completed",
  tramite_id: undefined, files: [], has_permanencia: false, has_renovacion: false,
};

describe("comparison contract commission eligibility", () => {
  test("uses trusted completeness for hidden agency and resets to the first eligible plan", () => {
    const hidden: ComparativaVM = { ...comparison, plan: ["fijo", "indexado"], comision: { fijo: null, indexado: null }, has_complete_commissions: { fijo: false, indexado: true } };
    const setPlan = vi.fn();
    render(<ComparativaToTramiteStep comparativa={hidden} userData={{ ...user, role: "2" }} plan="fijo" setPlan={setPlan} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(setPlan).toHaveBeenCalledWith("indexado");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["indexado"]);
    expect(createEmptyTramiteDB(user, "indexado", hidden).comision_sales_person).toBe(50);
  });
  test("offers only active assigned plans, retaining an explicitly assigned zero", () => {
    const submit = vi.fn();
    render(<ComparativaToTramiteStep comparativa={comparison} userData={user} plan="fijo" setPlan={vi.fn()} onSubmit={submit} onCancel={vi.fn()} />);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["fijo"]);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(submit).toHaveBeenCalledOnce();
    expect(createEmptyTramiteDB(user, "fijo", comparison)).toMatchObject({ comision: 0, comision_sales_person: 0 });
  });

  test("blocks an inactive selected plan even when it retains amounts", () => {
    render(<ComparativaToTramiteStep comparativa={comparison} userData={user} plan="indexado" setPlan={vi.fn()} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(() => createEmptyTramiteDB(user, "indexado", comparison)).toThrow("Asigna las comisiones");
  });

  test("never offers or converts an active plan with unassigned commissions", () => {
    const unassigned: ComparativaVM = { ...comparison, comision: { fijo: null, indexado: 100 } };
    render(<ComparativaToTramiteStep comparativa={unassigned} userData={user} plan="fijo" setPlan={vi.fn()} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryAllByRole("option")).toEqual([]);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
    expect(() => createEmptyTramiteDB(user, "fijo", unassigned)).toThrow("Asigna las comisiones");
  });
});
