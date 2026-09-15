import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { StudyResultDialog, type StudyResultController } from "./StudyResultDialog";
import type { StudyResultDTO } from "@/comparativas/types/study-result.types";

export const pendingResult = (overrides: Partial<StudyResultDTO> = {}): StudyResultDTO => ({
  id: "result-1", state: "pending", receivedType: "fijo", chosenType: null, typeOrigin: "received", targetPlan: "fijo", plans: ["fijo"], revision: "rev-1", pendingSteps: ["commissions"], hasExistingCommissions: true, offerAvailable: true, salesCalculable: true,
  current: { sales: 0, agency: 20 }, proposed: { sales: 12, agency: 60 },
  capabilities: { canResolve: true, canChooseType: false, canManualSales: true, commissionDecisions: ["keep", "apply", "manual"] }, resolution: null, ...overrides,
});

function setup(result = pendingResult(), role = "admin") {
  const controller = { draft: result, result, open: true, panelOpen: false, setPanelOpen: vi.fn(), loading: false, submitting: false, error: null, changed: false, canReview: true, startWatching: vi.fn(), review: vi.fn(), close: vi.fn(), preview: vi.fn(), submit: vi.fn() } satisfies StudyResultController;
  const view = render(<StudyResultDialog controller={controller} role={role} />);
  return { controller, ...view };
}

describe("Study result review", () => {
  test("unknown type has no preselection and changing it requests read-only previews", () => {
    const { controller, rerender } = setup(pendingResult({ receivedType: null, targetPlan: null, current: null, proposed: null, pendingSteps: ["type"] }));
    expect(screen.getByRole("heading", { name: "Selecciona el tipo de oferta" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Fijo" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Indexado" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Indexado" }));
    expect(controller.preview).toHaveBeenCalledWith("indexado");
    const selected = pendingResult({ receivedType: null, targetPlan: "indexado", revision: "rev-2", plans: ["fijo"] });
    rerender(<StudyResultDialog controller={{ ...controller, draft: selected }} role="admin" />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("radio", { name: /Añadir el plan/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("radio", { name: "Aplicar los importes propuestos" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver y revisar" }));
    expect(controller.preview).toHaveBeenLastCalledWith("indexado");
    rerender(<StudyResultDialog controller={{ ...controller, draft: { ...selected, revision: "rev-3" } }} role="admin" />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("radio", { name: /Añadir el plan/ })).not.toBeChecked();
    expect(controller.submit).not.toHaveBeenCalled();
  });

  test("zero is an existing conflict, valid type omitted and included plan none", () => {
    const { controller } = setup();
    expect(screen.getByText("0 €")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Mantener ambas comisiones actuales" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado" }));
    expect(controller.submit).toHaveBeenCalledWith({ resultId: "result-1", revision: "rev-1", planDecision: "none", commissionDecision: "keep" });
  });

  test.each(["add", "replace"] as const)("unknown missing plan can %s without an unnecessary commission step", (decision) => {
    const { controller } = setup(pendingResult({ receivedType: null, targetPlan: "indexado", hasExistingCommissions: false, pendingSteps: ["plan"], current: { sales: null, agency: null } }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("radio", { name: decision === "add" ? /Añadir el plan/ : /Sustituir el plan actual/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado" }));
    expect(controller.submit).toHaveBeenCalledWith({ resultId: "result-1", revision: "rev-1", chosenType: "indexado", planDecision: decision, commissionDecision: "apply" });
  });

  test("no offer preserves both amounts even with a replaced plan", () => {
    const { controller } = setup(pendingResult({ plans: ["indexado"], offerAvailable: false, proposed: null, capabilities: { canResolve: true, canChooseType: false, canManualSales: false, commissionDecisions: ["keep"] } }));
    expect(screen.getByText(/Ambas comisiones se mantienen sin cambios/)).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: /Sustituir el plan actual/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado" }));
    expect(controller.submit).toHaveBeenCalledWith(expect.objectContaining({ planDecision: "replace", commissionDecision: "keep" }));
  });

  test("role 2 sees neither agency nor manual and only allowed missing-sales decisions", () => {
    setup(pendingResult({ salesCalculable: false, current: { sales: 0 }, proposed: { sales: null }, capabilities: { canResolve: true, canChooseType: false, canManualSales: false, commissionDecisions: ["keep", "offer_keep_sales", "offer_clear_sales"] } }), "2");
    expect(screen.queryByText("Agencia")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /introducir/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText(/No se puede calcular la comisión comercial/)).toBeVisible();
    expect(screen.queryByRole("radio", { name: "Aplicar los importes propuestos" })).not.toBeInTheDocument();
  });

  test("empty target and incalculable sales defaults to clear without conflict step", () => {
    const { controller } = setup(pendingResult({ hasExistingCommissions: false, pendingSteps: [], salesCalculable: false, current: { sales: null }, proposed: { sales: null }, capabilities: { canResolve: true, canChooseType: false, canManualSales: false, commissionDecisions: ["keep", "offer_keep_sales", "offer_clear_sales"] } }), "2");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado" }));
    expect(controller.submit).toHaveBeenCalledWith(expect.objectContaining({ commissionDecision: "offer_clear_sales" }));
  });

  test("manual zero is accepted and only manual includes manualSales", () => {
    const { controller } = setup();
    fireEvent.click(screen.getByRole("radio", { name: /introducir la comisión comercial/ }));
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar resultado" }));
    expect(controller.submit).toHaveBeenCalledWith(expect.objectContaining({ commissionDecision: "manual", manualSales: 0 }));
  });

  test("cancel closes without submitting and changed revision resets confirmation", async () => {
    const { controller, rerender } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Aplicar los importes propuestos" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    rerender(<StudyResultDialog controller={{ ...controller, changed: true, draft: pendingResult({ revision: "rev-2" }) }} role="admin" />);
    expect(screen.getByRole("alert")).toHaveTextContent("El resultado ha cambiado");
    expect(screen.queryByRole("button", { name: "Confirmar resultado" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(controller.close).toHaveBeenCalledOnce());
    expect(controller.submit).not.toHaveBeenCalled();
  });
});
