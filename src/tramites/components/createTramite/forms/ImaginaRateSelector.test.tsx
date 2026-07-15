import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { ImaginaRate } from "@/comercializadoras/types";
import ImaginaRateSelector from "./ImaginaRateSelector";

const availableRate: ImaginaRate = {
  id: "rate-1",
  name: "Plan Noche",
  external_rate_id: "11001",
  alias_externo: "Noche",
  codigo_atr: "2.0TD",
  descripcion: "Energía nocturna con precio estable",
  synced_at: "2026-07-14T10:00:00.000Z",
};

const openSelector = () => {
  fireEvent.pointerDown(screen.getByRole("combobox"), {
    button: 0,
    ctrlKey: false,
    pointerId: 1,
    pointerType: "mouse",
  });
};

describe("ImaginaRateSelector", () => {
  test("shows the external alias, ATR code and description for available rates", () => {
    render(
      <ImaginaRateSelector
        rates={[availableRate]}
        selectedRateId="rate-1"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Noche");
    expect(screen.getByRole("combobox")).toHaveTextContent("2.0TD");
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-required",
      "true",
    );

    openSelector();

    expect(
      screen.getByRole("option", {
        name: "Noche 2.0TD Energía nocturna con precio estable",
      }),
    ).toBeInTheDocument();
  });

  test("shows matching historical metadata as an unavailable disabled option", () => {
    const unavailableRate: ImaginaRate = {
      ...availableRate,
      id: "legacy-record",
      name: "Tarifa antigua",
      external_rate_id: "legacy-42",
      alias_externo: null,
      descripcion: "Retirada del catálogo",
      synced_at: null,
    };

    render(
      <ImaginaRateSelector
        rates={[availableRate]}
        selectedRateId="legacy-42"
        historicalRateId="legacy-42"
        unavailableSelectedRate={unavailableRate}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Tarifa antigua");
    expect(screen.getByRole("combobox")).toHaveTextContent("No disponible");

    openSelector();

    const historicalOption = screen.getByRole("option", {
      name: /Tarifa antigua.*No disponible.*2\.0TD.*Retirada del catálogo/i,
    });
    expect(historicalOption).toHaveAttribute("data-disabled");
  });

  test("keeps an unknown historical id visible as an unavailable fallback", () => {
    render(
      <ImaginaRateSelector
        rates={[availableRate]}
        selectedRateId="missing-rate"
        historicalRateId="missing-rate"
        unavailableSelectedRate={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("missing-rate");
    expect(screen.getByRole("combobox")).toHaveTextContent("No disponible");

    openSelector();

    const historicalOption = screen.getByRole("option", {
      name: /missing-rate.*No disponible/i,
    });
    expect(historicalOption).toHaveAttribute("data-disabled");
  });
});
