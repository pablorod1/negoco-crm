import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { showCustomToast } from "@/core/components/CustomToast";
import type { ComparativaVM } from "@/comparativas/types/comparativa.types";
import type { User } from "@/core/types";
import ComparativaComissionsSection from "./ComparativaComissionsSection";

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: vi.fn(),
}));

const baseUser = {
  id: "admin-1",
  email: "admin@example.com",
  email_verified: true,
  name: "Admin",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  banned: false,
  image: null,
  organization: {
    id: "organization-1",
    name: "Negoco",
    logo: null,
    plan: null,
  },
  company: null,
  role: "1",
  super_id: null,
  should_reset_password: false,
} satisfies User;

const baseComparativa = {
  id: "comparison-1",
  client: "ACME",
  service: "Luz",
  plan: ["fijo"],
  comision: { fijo: 120, indexado: 80 },
  comision_sales_person: { fijo: 60, indexado: 40 },
  notes: [],
  user: {
    id: "sales-person-1",
    name: "Ana",
    email: "ana@example.com",
    role: "2",
  },
  creation_date: "2026-01-01",
  status: "completed",
  tramite_id: undefined,
  files: [],
  has_permanencia: false,
  has_renovacion: false,
} satisfies ComparativaVM;

type JsonBody = { success?: boolean; error?: string };

function response(status: number, body: JsonBody = { success: false }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function renderCommissionsSection({
  canEdit = true,
  onUpdate = vi.fn(),
  comparativa = baseComparativa,
}: {
  canEdit?: boolean;
  onUpdate?: () => void;
  comparativa?: ComparativaVM;
} = {}) {
  const view = render(
    <ComparativaComissionsSection
      userData={baseUser}
      comparativa={comparativa}
      canEdit={canEdit}
      onUpdate={onUpdate}
    />,
  );

  const rerenderCommissionsSection = ({
    nextCanEdit = canEdit,
    nextComparativa = comparativa,
  }: {
    nextCanEdit?: boolean;
    nextComparativa?: ComparativaVM;
  }) => {
    view.rerender(
      <ComparativaComissionsSection
        userData={baseUser}
        comparativa={nextComparativa}
        canEdit={nextCanEdit}
        onUpdate={onUpdate}
      />,
    );
  };

  return { ...view, onUpdate, rerenderCommissionsSection };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function startEditing() {
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
}

function organizationFixedInput() {
  return screen.getByRole("spinbutton", {
    name: "Comisión Fijo de Negoco",
  });
}

function changeOrganizationFixed(value = "125") {
  fireEvent.change(organizationFixedInput(), {
    target: { value },
  });
}

function save() {
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar comisiones" }),
  );
}

describe("ComparativaComissionsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("shows only active-plan commissions while preserving inactive values", () => {
    const { rerenderCommissionsSection } = renderCommissionsSection();

    expect(screen.getAllByText("120,00 €")).toHaveLength(1);
    expect(screen.getAllByText("60,00 €")).toHaveLength(1);
    expect(screen.queryByText("80,00 €")).not.toBeInTheDocument();
    expect(screen.queryByText("40,00 €")).not.toBeInTheDocument();

    startEditing();

    expect(organizationFixedInput()).toHaveValue(120);
    expect(
      screen.queryByRole("spinbutton", {
        name: "Comisión Indexado de Negoco",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancelar edición de comisiones",
      }),
    );
    rerenderCommissionsSection({
      nextComparativa: {
        ...baseComparativa,
        plan: ["indexado"],
      },
    });

    expect(screen.getAllByText("80,00 €")).toHaveLength(1);
    expect(screen.getAllByText("40,00 €")).toHaveLength(1);
    expect(screen.queryByText("120,00 €")).not.toBeInTheDocument();
    expect(screen.queryByText("60,00 €")).not.toBeInTheDocument();

    startEditing();
    expect(
      screen.getByRole("spinbutton", {
        name: "Comisión Indexado de Negoco",
      }),
    ).toHaveValue(80);
  });

  test("sends only active changed commissions without a user id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderCommissionsSection();
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v2/comparisons/comparison-1/commissions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comissions: { comision_fijo: 125 },
          }),
        },
      );
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).not.toHaveProperty("user_id");
  });

  test("closes, confirms success, and refreshes after saving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(200, { success: true })),
    );
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce();
    });
    expect(
      screen.queryByRole("button", { name: "Guardar comisiones" }),
    ).not.toBeInTheDocument();
    expect(showCustomToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Comisiones actualizadas" }),
    );
  });

  test("keeps the draft recoverable when the session has expired", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(401, { success: false, error: "Unauthorized" }),
      ),
    );
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sesión caducada",
          message: expect.stringContaining("iniciar sesión"),
        }),
      );
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(organizationFixedInput()).toHaveValue(125);
    expect(
      screen.getByRole("button", { name: "Guardar comisiones" }),
    ).toBeEnabled();
  });

  test("keeps the draft recoverable when permission is denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(403, { success: false, error: "Forbidden" }),
      ),
    );
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sin permiso para editar",
          message: expect.stringContaining("permiso"),
        }),
      );
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(organizationFixedInput()).toHaveValue(125);
    expect(
      screen.getByRole("button", { name: "Guardar comisiones" }),
    ).toBeEnabled();
  });

  test("closes and uses the refreshed comparison after a stale conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(409, {
          success: false,
          error: "Comparison status changed",
        }),
      ),
    );
    const onUpdate = vi.fn();

    function ConflictHarness() {
      const [comparativa, setComparativa] =
        useState<ComparativaVM>(baseComparativa);

      const refreshComparison = () => {
        onUpdate();
        setComparativa({
          ...baseComparativa,
          plan: ["indexado"],
          comision: { fijo: 120, indexado: 95 },
          comision_sales_person: { fijo: 60, indexado: 45 },
        });
      };

      return (
        <ComparativaComissionsSection
          userData={baseUser}
          comparativa={comparativa}
          canEdit
          onUpdate={refreshComparison}
        />
      );
    }

    render(<ConflictHarness />);
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce();
    });
    expect(
      screen.queryByRole("button", { name: "Guardar comisiones" }),
    ).not.toBeInTheDocument();
    expect(showCustomToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "La comparativa ha cambiado",
        message: expect.stringContaining("recargado"),
      }),
    );
    expect(screen.getByText("95,00 €")).toBeVisible();
    expect(screen.queryByText("120,00 €")).not.toBeInTheDocument();

    startEditing();
    expect(
      screen.getByRole("spinbutton", {
        name: "Comisión Indexado de Negoco",
      }),
    ).toHaveValue(95);
    expect(
      screen.queryByRole("spinbutton", {
        name: "Comisión Fijo de Negoco",
      }),
    ).not.toBeInTheDocument();
  });

  test("keeps the draft recoverable after an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(500, {
          success: false,
          error: "El servidor no pudo guardar las comisiones",
        }),
      ),
    );
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No se pudieron guardar las comisiones",
          message: "El servidor no pudo guardar las comisiones",
        }),
      );
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(organizationFixedInput()).toHaveValue(125);
    expect(
      screen.getByRole("button", { name: "Guardar comisiones" }),
    ).toBeEnabled();
  });

  test("keeps the draft recoverable when an error response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
      }),
    );
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No se pudieron guardar las comisiones",
          message: expect.stringContaining("reintentarlo"),
        }),
      );
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(organizationFixedInput()).toHaveValue(125);
    expect(
      screen.getByRole("button", { name: "Guardar comisiones" }),
    ).toBeEnabled();
  });

  test("keeps the draft recoverable when a successful status has an API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(200, {
          success: false,
          error: "La actualización fue rechazada",
        }),
      ),
    );
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No se pudieron guardar las comisiones",
          message: "La actualización fue rechazada",
        }),
      );
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(organizationFixedInput()).toHaveValue(125);
  });

  test("keeps the draft recoverable when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    await waitFor(() => {
      expect(showCustomToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No se pudieron guardar las comisiones",
          message: expect.stringContaining("conectar"),
        }),
      );
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(organizationFixedInput()).toHaveValue(125);
    expect(
      screen.getByRole("button", { name: "Guardar comisiones" }),
    ).toBeEnabled();
  });

  test("prevents duplicate submissions and disables editing while saving", async () => {
    let resolveRequest: (value: ReturnType<typeof response>) => void =
      () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onUpdate = vi.fn();
    renderCommissionsSection({ onUpdate });
    startEditing();
    changeOrganizationFixed();

    const saveButton = screen.getByRole("button", {
      name: "Guardar comisiones",
    });
    const cancelButton = screen.getByRole("button", {
      name: "Cancelar edición de comisiones",
    });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(organizationFixedInput()).toBeDisabled();

    resolveRequest(response(200, { success: true }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce();
    });
  });

  test("silently revalidates a successful stale same-id mutation", async () => {
    const firstRequest = deferred<ReturnType<typeof response>>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const onUpdate = vi.fn();
    const { rerenderCommissionsSection } = renderCommissionsSection({
      onUpdate,
    });
    startEditing();
    changeOrganizationFixed();
    save();

    rerenderCommissionsSection({
      nextComparativa: {
        ...baseComparativa,
        comision: { fijo: 121, indexado: 80 },
      },
    });

    const editButton = screen.getByRole("button", { name: "Editar" });
    expect(editButton).toBeDisabled();
    fireEvent.click(editButton);
    expect(
      screen.queryByRole("button", { name: "Guardar comisiones" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();

    firstRequest.resolve(response(200, { success: true }));

    await waitFor(() => {
      expect(editButton).toBeEnabled();
    });
    expect(showCustomToast).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledOnce();

    startEditing();
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Comisión Fijo de Negoco",
      }),
      {
        target: { value: "127" },
      },
    );
    save();

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v2/comparisons/comparison-1/commissions",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comissions: { comision_fijo: 127 },
        }),
      },
    );
  });

  test("allows an independent new-id request after the old view unmounts", async () => {
    const oldRequest = deferred<ReturnType<typeof response>>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const oldOnUpdate = vi.fn();
    const oldView = renderCommissionsSection({ onUpdate: oldOnUpdate });
    startEditing();
    changeOrganizationFixed();
    save();

    oldView.unmount();

    const newOnUpdate = vi.fn();
    renderCommissionsSection({
      comparativa: {
        ...baseComparativa,
        id: "comparison-2",
        comision: { fijo: 130, indexado: 80 },
      },
      onUpdate: newOnUpdate,
    });
    startEditing();
    changeOrganizationFixed("135");
    save();

    await waitFor(() => {
      expect(newOnUpdate).toHaveBeenCalledOnce();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v2/comparisons/comparison-2/commissions",
      expect.objectContaining({
        body: JSON.stringify({
          comissions: { comision_fijo: 135 },
        }),
      }),
    );
    const toastCallsAfterNewRequest = vi.mocked(showCustomToast).mock.calls
      .length;

    await act(async () => {
      oldRequest.resolve(response(200, { success: true }));
      await oldRequest.promise;
    });

    expect(oldOnUpdate).not.toHaveBeenCalled();
    expect(showCustomToast).toHaveBeenCalledTimes(
      toastCallsAfterNewRequest,
    );
  });

  test("closes and resets the editor if edit permission is removed", () => {
    const { rerenderCommissionsSection } = renderCommissionsSection();
    startEditing();
    changeOrganizationFixed();

    rerenderCommissionsSection({ nextCanEdit: false });

    expect(
      screen.queryByRole("button", { name: "Guardar comisiones" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar" }),
    ).not.toBeInTheDocument();

    rerenderCommissionsSection({ nextCanEdit: true });
    startEditing();
    expect(organizationFixedInput()).toHaveValue(120);
  });

  test("keeps the existing no-changes behavior without making a request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCommissionsSection();
    startEditing();
    save();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Guardar comisiones" }),
    ).not.toBeInTheDocument();
    expect(showCustomToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "No se han realizado cambios" }),
    );
  });
});
