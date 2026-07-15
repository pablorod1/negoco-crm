import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { ContractDB } from "@/tramites/types";
import ImaginaContractFields from "./ImaginaContractFields";

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: vi.fn(),
}));

const formData: ContractDB = {
  id: "contract-1",
  type: "Cambio Compañía",
  province: "Madrid",
  city: "Madrid",
  address: "Calle Mayor 1",
  postal_code: "28001",
  new_company: "imagina-id",
  plan: "2.0TD",
  consumption: 2500,
  CUPS: "ES123456789012345678",
  pot1: 3.45,
  pot2: 3.45,
  pot3: 0,
  pot4: 0,
  pot5: 0,
  pot6: 0,
  description: "",
  tramite_id: "tramite-1",
  rate_id: null,
};

test("does not render a rate selector or notice for an unconfigured tenant", () => {
  render(
    <ImaginaContractFields
      formData={formData}
      setFormData={vi.fn()}
      integration={{ enabled: true, configured: false }}
      rates={[]}
      unavailableSelectedRate={null}
      ratesLoading={false}
      ratesError={null}
      onRateChange={vi.fn()}
    />,
  );

  expect(screen.queryByText(/Tarifa Imagina/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("Canal firma")).toBeInTheDocument();
});
