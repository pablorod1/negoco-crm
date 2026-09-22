import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComercializadoraVM } from "@/comercializadoras/types";
import type { DefaultCompanyCommission, User, UserCompanyCommission } from "@/core/types";
import CommissionDefaultsEditor from "./CommissionDefaultsEditor";
import OverrideMatrixEditor from "./OverrideMatrixEditor";

vi.mock("@/core/components/CustomToast", () => ({ showCustomToast: vi.fn() }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const suppliers = [{ id: "supplier-1", name: "Comercializadora A" }] as ComercializadoraVM[];
const defaults = [
  { comercializadora_id: "supplier-1", segment: "luz_20td", commission_type: "percent", commission_value: 10 },
  { comercializadora_id: "supplier-1", segment: "luz_pymes", commission_type: "percent", commission_value: 20 },
  { comercializadora_id: "supplier-1", segment: "gas", commission_type: "fixed", commission_value: 50 },
] as DefaultCompanyCommission[];

describe("edición multisegmento", () => {
  it("unifica los segmentos editados y conserva las reglas de los demás segmentos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CommissionDefaultsEditor suppliers={suppliers} defaults={defaults} segments={["luz_20td", "luz_pymes"]} loading={false} onDirtyChange={vi.fn()} onSaved={vi.fn()} />);

    const input = screen.getByRole("spinbutton", { name: "Comisión de Comercializadora A" });
    expect(input).toHaveAttribute("placeholder", "Valores distintos");
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.defaults).toEqual(expect.arrayContaining([
      expect.objectContaining({ segment: "luz_20td", commission_value: 25 }),
      expect.objectContaining({ segment: "luz_pymes", commission_value: 25 }),
      expect.objectContaining({ segment: "gas", commission_value: 50, commission_type: "fixed" }),
    ]));
    expect(payload.defaults).toHaveLength(3);
  });

  it("conserva los borradores al cambiar segmentos y permite descartar valores inválidos", () => {
    const props = { suppliers, defaults, loading: false, onDirtyChange: vi.fn(), onSaved: vi.fn() };
    const { rerender } = render(<CommissionDefaultsEditor {...props} segments={["luz_20td"]} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Comisión de Comercializadora A" }), { target: { value: "-5" } });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    rerender(<CommissionDefaultsEditor {...props} segments={["gas"]} />);
    expect(screen.getByRole("spinbutton", { name: "Comisión de Comercializadora A" })).toHaveValue(50);
    rerender(<CommissionDefaultsEditor {...props} segments={["luz_20td"]} />);
    expect(screen.getByRole("spinbutton", { name: "Comisión de Comercializadora A" })).toHaveValue(-5);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("spinbutton", { name: "Comisión de Comercializadora A" })).toHaveValue(10);
  });

  it.each(["inherit", "overwrite"] as const)("aplica %s solo a los segmentos seleccionados desde una celda mixta", async (mode) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const onRefetch = vi.fn();
    render(<OverrideMatrixEditor
      users={[{ id: "user-1", name: "Ana", email: "ana@example.com", role: "2", banned: false }] as User[]}
      suppliers={suppliers} defaults={defaults}
      overrides={[{ user_id: "user-1", comercializadora_id: "supplier-1", segment: "luz_20td", commission_type: "percent", commission_value: 30 }] as UserCompanyCommission[]}
      segments={["luz_20td", "luz_pymes"]} loading={false} onRefetch={onRefetch}
    />);
    fireEvent.click(screen.getByRole("button", { name: /Valores distintos/ }));
    if (mode === "overwrite") {
      fireEvent.change(screen.getByRole("spinbutton", { name: "Valor de comisión personalizada" }), { target: { value: "35" } });
    }
    fireEvent.click(screen.getByRole("button", { name: mode === "inherit" ? "Usar defecto" : "Guardar" }));
    await waitFor(() => expect(onRefetch).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/commissions/bulk");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      user_ids: ["user-1"], comercializadora_ids: ["supplier-1"],
      segments: ["luz_20td", "luz_pymes"], mode,
      ...(mode === "overwrite" ? { commission_type: "percent", commission_value: 35 } : {}),
    });
  });
});
