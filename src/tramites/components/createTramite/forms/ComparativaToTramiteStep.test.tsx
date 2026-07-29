import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ComparativaToTramiteStep from "./ComparativaToTramiteStep";

vi.mock("@/comercializadoras/hooks/useEnergySupplierById", () => ({
  useEnergySupplierById: () => ({
    supplier: { name: "Comercializadora Demo" },
  }),
}));
vi.mock("next-view-transitions", () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useTransitionRouter: () => ({ push: vi.fn() }),
}));

const comparativa = {
  id: "comparison-1",
  client: "ACME",
  service: "Luz",
  company_id: "supplier-1",
  plan: ["fijo"],
  status: "completed",
  user: { name: "Ana" },
  comision: { fijo: 10, indexado: 0 },
  comision_sales_person: { fijo: 5, indexado: 0 },
  files: [],
  notes: [],
  abarca_estudio: {
    nombre_completo: "Ada Lovelace",
    dni: "12345678Z",
    cups: "ES001234567890",
    tipo_tarifa: "2.0TD",
    email: "ada@example.com",
    movil: "600000000",
    calle_cups: "Calle Mayor",
    numero_cups: "1",
    localidad_cups: "Madrid",
    codpostal_cups: "28001",
  },
};

describe("ComparativaToTramiteStep public copy", () => {
  test("labels imported comparator data as an AI study", () => {
    render(
      <ComparativaToTramiteStep
        comparativa={comparativa as never}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        plan="fijo"
        setPlan={vi.fn()}
        userData={{ role: "1" } as never}
      />,
    );

    expect(screen.getByText("Datos del estudio con IA")).toBeInTheDocument();
    expect(screen.queryByText(/Abarca/i)).not.toBeInTheDocument();
  });
});
