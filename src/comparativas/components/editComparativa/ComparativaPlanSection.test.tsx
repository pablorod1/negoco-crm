import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { showCustomToast } from "@/core/components/CustomToast";
import ComparativaPlanSection from "./ComparativaPlanSection";

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: vi.fn(),
}));

const baseComparativa = {
  id: "comparison-1",
  client: "ACME",
  service: "Luz",
  plan: ["fijo"],
  comision: { fijo: 120, indexado: 80 },
  comision_sales_person: { fijo: 60, indexado: 40 },
  notes: [],
  user: { id: "user-1", name: "Ana", email: "ana@example.com", role: "2" },
  creation_date: "2026-01-01",
  status: "completed",
  tramite_id: undefined,
  files: [],
  has_permanencia: false,
  has_renovacion: false,
};

function renderPlanSection({
  plan = ["fijo"],
  canEdit = true,
  onUpdate = vi.fn(),
}: {
  plan?: Array<"fijo" | "indexado">;
  canEdit?: boolean;
  onUpdate?: () => void;
} = {}) {
  render(
    <ComparativaPlanSection
      comparativa={{ ...baseComparativa, plan } as never}
      canEdit={canEdit}
      onUpdate={onUpdate}
    />,
  );

  return { onUpdate };
}

function startEditing() {
  fireEvent.click(screen.getByRole("button", { name: "Editar planes" }));
}

describe("ComparativaPlanSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("always presents the current plans with readable labels", () => {
    renderPlanSection({ plan: ["fijo", "indexado"], canEdit: false });

    const section = screen.getByRole("region", {
      name: "Planes de la comparativa",
    });

    expect(section).toHaveTextContent("Fijo");
    expect(section).toHaveTextContent("Indexado");
    expect(
      screen.queryByRole("button", { name: "Editar planes" }),
    ).not.toBeInTheDocument();
  });

  test("disables save for unchanged or empty selections", () => {
    renderPlanSection();
    startEditing();

    const saveButton = screen.getByRole("button", {
      name: "Guardar planes",
    });
    const fijoCheckbox = screen.getByRole("checkbox", { name: "Fijo" });

    expect(fijoCheckbox).toBeChecked();
    expect(saveButton).toBeDisabled();

    fireEvent.click(fijoCheckbox);

    expect(fijoCheckbox).not.toBeChecked();
    expect(saveButton).toBeDisabled();
  });

  test("saves a non-empty plan transition with the exact request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPlanSection();
    startEditing();

    fireEvent.click(screen.getByRole("checkbox", { name: "Indexado" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Fijo" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar planes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v2/comparisons/comparison-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: ["indexado"] }),
        },
      );
    });
  });

  test("disables save while the request is in flight", async () => {
    let resolveRequest: (response: { ok: boolean; status: number }) => void =
      () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      ),
    );
    renderPlanSection();
    startEditing();

    fireEvent.click(screen.getByRole("checkbox", { name: "Indexado" }));
    const saveButton = screen.getByRole("button", {
      name: "Guardar planes",
    });
    fireEvent.click(saveButton);

    expect(saveButton).toBeDisabled();

    resolveRequest({ ok: true, status: 200 });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Guardar planes" }),
      ).not.toBeInTheDocument();
    });
  });

  test("cancel restores the original plan", () => {
    renderPlanSection();
    startEditing();

    fireEvent.click(screen.getByRole("checkbox", { name: "Indexado" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Fijo" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Cancelar edición de planes" }),
    );

    expect(
      screen.queryByRole("checkbox", { name: "Indexado" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Fijo")).toBeVisible();
    expect(screen.queryByText("Indexado")).not.toBeInTheDocument();

    startEditing();
    expect(screen.getByRole("checkbox", { name: "Fijo" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Indexado" }),
    ).not.toBeChecked();
  });

  test("closes, confirms success, and refreshes after saving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    const onUpdate = vi.fn();
    renderPlanSection({ onUpdate });
    startEditing();

    fireEvent.click(screen.getByRole("checkbox", { name: "Indexado" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar planes" }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce();
    });
    expect(
      screen.queryByRole("checkbox", { name: "Fijo" }),
    ).not.toBeInTheDocument();
    expect(showCustomToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Planes actualizados",
      }),
    );
  });

  test("closes and refreshes after a conflict so the parent can resync", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 409 }),
    );
    const onUpdate = vi.fn();
    renderPlanSection({ onUpdate });
    startEditing();

    fireEvent.click(screen.getByRole("checkbox", { name: "Indexado" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar planes" }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce();
    });
    expect(
      screen.queryByRole("checkbox", { name: "Fijo" }),
    ).not.toBeInTheDocument();
    expect(showCustomToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "La comparativa ha cambiado",
        message: expect.stringContaining("recargado"),
      }),
    );
  });

  test("keeps the edited selection recoverable after other failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const onUpdate = vi.fn();
    renderPlanSection({ onUpdate });
    startEditing();

    const indexadoCheckbox = screen.getByRole("checkbox", {
      name: "Indexado",
    });
    fireEvent.click(indexadoCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Guardar planes" }));

    await waitFor(() => {
      expect(showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No se pudieron guardar los planes",
        }),
      );
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(indexadoCheckbox).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Guardar planes" }),
    ).toBeEnabled();
  });
});
