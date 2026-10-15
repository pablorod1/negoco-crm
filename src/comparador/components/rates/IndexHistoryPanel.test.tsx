import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { SupplierRatesResponse } from "./api";
import { IndexHistoryPanel } from "./IndexHistoryPanel";

const saveIndexHistory = vi.fn(async () => ({ saved: 2 }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  ratesApi: { saveIndexHistory: (...args: unknown[]) => saveIndexHistory(...(args as [])), deleteIndexHistoryMonth: vi.fn() },
}));

const data = {
  supplier: { id: "COM-1", name: "Gana Energía", active: true },
  rates: [],
  indexHistory: [
    { id: "a", comercializadoraId: "COM-1", rateId: null, accessTariff: "2.0TD", month: "2026-01", energy: { P1: 0.14, P2: 0.12, P3: 0.09 }, source: "manual", ingestId: null, updatedAt: "" },
    { id: "b", comercializadoraId: "COM-1", rateId: null, accessTariff: "2.0TD", month: "2026-03", energy: { P1: 0.15, P2: 0.12, P3: 0.09 }, source: "manual", ingestId: null, updatedAt: "" },
  ],
  canManage: true,
} as unknown as SupplierRatesResponse;

describe("IndexHistoryPanel", () => {
  test("shows the months, the gap, and saves pasted rows in €/kWh", async () => {
    render(<IndexHistoryPanel data={data} onSaved={() => {}} />);
    expect(screen.getByText(/Cubre de ene 2026 a mar 2026 · 2 meses · faltan feb 2026/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Añadir meses" }));
    fireEvent.click(screen.getByRole("button", { name: "€/MWh" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "feb-2026\t150\t120\t90\nabr-2026\t160\t125\t95" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar 2 meses/ }));
    expect(saveIndexHistory).toHaveBeenCalledWith("COM-1", null, [
      { month: "2026-02", energy: { P1: 0.15, P2: 0.12, P3: 0.09 } },
      { month: "2026-04", energy: { P1: 0.16, P2: 0.125, P3: 0.095 } },
    ]);
  });
});
