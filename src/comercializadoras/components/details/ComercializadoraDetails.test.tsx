import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type {
  ComercializadoraDetails as ComercializadoraDetailsData,
  ImaginaRate,
} from "@/comercializadoras/types";
import ComercializadoraDetails from "./ComercializadoraDetails";

const mockUseParams = vi.fn();
const mockUseComercializadora = vi.fn();
const mockUseImaginaRates = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));

vi.mock("next-view-transitions", () => ({
  Link: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/core/contexts/UserContext", () => ({
  useUser: () => ({ userData: { id: "user-1", role: "1" } }),
}));

vi.mock("@/comercializadoras/hooks/useComercializadora", () => ({
  useComercializadora: (...args: unknown[]) =>
    mockUseComercializadora(...args),
}));

vi.mock("@/comercializadoras/hooks/useImaginaRates", () => ({
  useImaginaRates: (...args: unknown[]) => mockUseImaginaRates(...args),
}));

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: vi.fn(),
}));

vi.mock("./ComercializadoraMainView", () => ({
  ComercializadoraMainView: () => <div>Vista principal</div>,
}));

vi.mock("./ComercializadoraTramitesTable", () => ({
  ComercializadoraTramitesTable: () => <div>Vista de trámites</div>,
}));

vi.mock("./ComercializadoraDocumentsList", () => ({
  ComercializadoraDocumentsList: () => <div>Vista de documentos</div>,
}));

vi.mock("./ComercializadoraRatesSection", () => ({
  ComercializadoraRatesSection: ({ rates }: { rates: ImaginaRate[] }) => (
    <div data-testid="rates-section">{rates[0]?.alias_externo}</div>
  ),
}));

const createSupplier = (name: string): ComercializadoraDetailsData => ({
  id: "supplier-1",
  name,
  active: true,
  logo: null,
  num_tramites: 0,
  num_files: 0,
  total_consumption: 0,
  files: [],
  rates: [],
});

const imaginaRate: ImaginaRate = {
  id: "rate-1",
  name: "Plan Noche",
  external_rate_id: "11001",
  alias_externo: "Noche estable",
  codigo_atr: "2.0TD",
  descripcion: "Energía nocturna con precio estable",
  synced_at: "2026-07-14T10:00:00.000Z",
};

const setSupplier = (name: string) => {
  mockUseComercializadora.mockReturnValue({
    comercializadora: createSupplier(name),
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
};

const setRatesIntegration = (configured: boolean) => {
  mockUseImaginaRates.mockReturnValue({
    data: null,
    integration: { enabled: configured, configured },
    rates: configured ? [imaginaRate] : [],
    unavailableSelectedRate: null,
    loading: false,
    error: null,
  });
};

beforeEach(() => {
  mockUseParams.mockReturnValue({ id: "IMAGINA ENERGIA" });
  setSupplier("Imagina Energía");
  setRatesIntegration(true);
});

describe("ComercializadoraDetails rates view", () => {
  test("enables the rates request from params before supplier details resolve", () => {
    mockUseParams.mockReturnValue({ id: "Imagina%20Energ%C3%ADa" });
    mockUseComercializadora.mockReturnValue({
      comercializadora: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<ComercializadoraDetails />);

    expect(mockUseImaginaRates).toHaveBeenCalledWith({ enabled: true });
  });

  test("shows the configured Imagina tab and renders its section on selection", () => {
    render(<ComercializadoraDetails />);

    expect(mockUseImaginaRates).toHaveBeenCalledWith({ enabled: true });

    fireEvent.click(screen.getByRole("button", { name: "Tarifas" }));

    expect(screen.getByTestId("rates-section")).toHaveTextContent(
      "Noche estable",
    );
    expect(screen.queryByText("Vista principal")).not.toBeInTheDocument();
  });

  test("hides rates when the Imagina integration is not configured", () => {
    setRatesIntegration(false);

    render(<ComercializadoraDetails />);

    expect(
      screen.queryByRole("button", { name: "Tarifas" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("rates-section")).not.toBeInTheDocument();
  });

  test("keeps the rates tab hidden while the catalog is loading", () => {
    mockUseImaginaRates.mockReturnValue({
      data: null,
      integration: { enabled: true, configured: true },
      rates: [imaginaRate],
      unavailableSelectedRate: null,
      loading: true,
      error: null,
    });

    render(<ComercializadoraDetails />);

    expect(
      screen.queryByRole("button", { name: "Tarifas" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("rates-section")).not.toBeInTheDocument();
  });

  test("does not request or show Imagina rates for another supplier", () => {
    mockUseParams.mockReturnValue({ id: "Otra Comercializadora" });
    setSupplier("Otra Comercializadora");

    render(<ComercializadoraDetails />);

    expect(mockUseImaginaRates).toHaveBeenCalledWith({ enabled: false });
    expect(
      screen.queryByRole("button", { name: "Tarifas" }),
    ).not.toBeInTheDocument();
  });

  test("returns to the main view when rates stop being available", async () => {
    const { rerender } = render(<ComercializadoraDetails />);
    fireEvent.click(screen.getByRole("button", { name: "Tarifas" }));
    expect(screen.getByTestId("rates-section")).toBeInTheDocument();

    setRatesIntegration(false);
    rerender(<ComercializadoraDetails />);

    await waitFor(() =>
      expect(screen.getByText("Vista principal")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("rates-section")).not.toBeInTheDocument();
  });
});
