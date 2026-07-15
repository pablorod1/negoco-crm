import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { ImaginaRate } from "@/comercializadoras/types";
import { ComercializadoraRatesSection } from "./ComercializadoraRatesSection";

const rates: ImaginaRate[] = [
  {
    id: "rate-1",
    name: "Plan Noche",
    external_rate_id: "11001",
    alias_externo: "Noche estable",
    codigo_atr: "2.0TD",
    descripcion: "Energía nocturna con precio estable",
    synced_at: "2026-07-14T10:00:00.000Z",
  },
  {
    id: "rate-2",
    name: "Plan Solar",
    external_rate_id: "11002",
    alias_externo: null,
    codigo_atr: null,
    descripcion: null,
    synced_at: null,
  },
  {
    id: "rate-3",
    name: "",
    external_rate_id: "EXT-003",
    alias_externo: null,
    codigo_atr: "3.0TD",
    descripcion: "Tarifa para suministros de mayor potencia",
    synced_at: "2026-07-13T10:00:00.000Z",
  },
];

describe("ComercializadoraRatesSection", () => {
  test("renders synced rates with aliases, fallbacks and metadata", () => {
    render(<ComercializadoraRatesSection rates={rates} />);

    expect(
      screen.getByRole("heading", { name: "Tarifas sincronizadas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 tarifas")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Noche estable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Plan Solar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "EXT-003" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2.0TD")).toBeInTheDocument();
    expect(
      screen.getByText("Energía nocturna con precio estable"),
    ).toBeInTheDocument();
    expect(screen.getByText("14 Jul 2026")).toBeInTheDocument();
    expect(screen.getByText("Sin código ATR")).toBeInTheDocument();
    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
    expect(
      screen.getByText("Sin fecha de sincronización"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/€\/kWh/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("associates every rate value with a semantic description term", () => {
    render(<ComercializadoraRatesSection rates={[rates[0]]} />);

    const rateItem = screen.getByRole("listitem");
    const terms = Array.from(rateItem.querySelectorAll("dt")).map((term) =>
      term.textContent?.trim(),
    );
    const descriptions = Array.from(rateItem.querySelectorAll("dd"));

    expect(terms).toEqual([
      "Tarifa",
      "Código ATR",
      "Descripción",
      "Sincronización",
    ]);
    expect(descriptions).toHaveLength(4);
    expect(
      within(descriptions[0]).getByRole("heading", {
        name: "Noche estable",
      }),
    ).toHaveAttribute("title", "Noche estable");
    expect(within(descriptions[1]).getByText("2.0TD")).toBeInTheDocument();
    expect(
      within(descriptions[2]).getByText("Energía nocturna con precio estable"),
    ).toBeInTheDocument();
    expect(within(descriptions[3]).getByText("14 Jul 2026")).toBeInTheDocument();
  });

  test("uses a safe fallback instead of an invalid datetime element", () => {
    const invalidDateRate: ImaginaRate = {
      ...rates[0],
      id: "invalid-date-rate",
      synced_at: "not-a-date",
    };
    const { container } = render(
      <ComercializadoraRatesSection rates={[invalidDateRate]} />,
    );

    expect(
      screen.getByText("Sin fecha de sincronización"),
    ).toBeInTheDocument();
    expect(container.querySelector("time")).not.toBeInTheDocument();
  });

  test("renders the configured integration empty state", () => {
    render(<ComercializadoraRatesSection rates={[]} />);

    expect(
      screen.getByRole("heading", {
        name: "Aún no hay tarifas sincronizadas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "La integración está configurada, pero todavía no hay tarifas disponibles en el catálogo.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("0 tarifas")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
