import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ContractDB } from "@/tramites/types";
import ContractForm from "./ContractForm";
import EditContractForm from "@/tramites/components/editTramite/contract/EditContractForm";

const mocks = vi.hoisted(() => ({
  showCustomToast: vi.fn(),
  useActiveEnergySuppliers: vi.fn(),
  useImaginaRates: vi.fn(),
}));

vi.mock("@/comercializadoras/hooks/useActiveEnergySuppliers", () => ({
  useActiveEnergySuppliers: mocks.useActiveEnergySuppliers,
}));

vi.mock("@/comercializadoras/hooks/useImaginaRates", () => ({
  useImaginaRates: mocks.useImaginaRates,
}));

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: mocks.showCustomToast,
}));

vi.mock("@/core/components/ButtonGroupComponent", () => ({
  default: ({
    onSubmit,
    submitDisabled,
  }: {
    onSubmit: () => void;
    submitDisabled?: boolean;
  }) => (
    <button type="button" onClick={onSubmit} disabled={submitDisabled}>
      Guardar
    </button>
  ),
}));

vi.mock("@/tramites/components/createTramite/FormWrapper", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/core/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/tramites/components/createTramite/InputComponent", () => ({
  InputComponent: ({
    name,
    label,
    value,
    onChange,
  }: {
    name: string;
    label?: string;
    value: string | number;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <label>
      {label}
      <input
        aria-label={label || name}
        name={name}
        value={value}
        onChange={onChange}
      />
    </label>
  ),
  SelectComponent: ({
    name,
    label,
    items,
    selectedKey,
    onChange,
    errors,
  }: {
    name: string;
    label: string;
    items: unknown[];
    selectedKey: string;
    onChange: (value: string) => void;
    errors?: string;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        name={name}
        value={selectedKey}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Seleccione una opción</option>
        {items.map((item) => {
          if (typeof item === "string") {
            return (
              <option key={item} value={item}>
                {item}
              </option>
            );
          }

          const option = item as {
            id?: string;
            name?: string;
            label?: string;
            value?: string;
          };
          const value = option.value || option.id || "";
          return (
            <option key={value} value={value}>
              {option.label || option.name || value}
            </option>
          );
        })}
      </select>
      {errors ? <span>{errors}</span> : null}
    </label>
  ),
}));

vi.mock("./ImaginaContractFields", () => ({
  default: ({
    integration,
    rateError,
    onRateChange,
  }: {
    integration: { configured: boolean } | null;
    rateError?: string;
    onRateChange: (rateId: string) => void;
  }) => (
    <section aria-label="Campos Imagina">
      {integration?.configured ? (
        <button type="button" onClick={() => onRateChange("rate-1")}>
          Elegir tarifa vigente
        </button>
      ) : null}
      {rateError ? <p>{rateError}</p> : null}
    </section>
  ),
}));

const availableRate = {
  id: "rate-1",
  name: "Plan Noche",
  external_rate_id: "11001",
  alias_externo: "Noche",
  codigo_atr: "2.0TD",
  descripcion: "Tarifa nocturna",
  synced_at: "2026-07-14T10:00:00.000Z",
};

const activeSuppliers = [
  {
    id: "imagina-id",
    name: "Imagina Energía",
    active: true,
    logo: null,
    num_tramites: 0,
    num_files: 0,
    total_consumption: 0,
  },
  {
    id: "other-id",
    name: "Otra Energía",
    active: true,
    logo: null,
    num_tramites: 0,
    num_files: 0,
    total_consumption: 0,
  },
  {
    id: "third-id",
    name: "Tercera Energía",
    active: true,
    logo: null,
    num_tramites: 0,
    num_files: 0,
    total_consumption: 0,
  },
];

const supplierHookResult = (
  suppliers = activeSuppliers,
  loading = false,
  error: string | null = null,
) => ({
  activeSuppliers: suppliers,
  loading,
  error,
  refetch: vi.fn(),
});

const configuredRates = {
  data: {
    integration: { enabled: true, configured: true },
    rates: [availableRate],
    unavailable_selected_rate: null,
  },
  integration: { enabled: true, configured: true },
  rates: [availableRate],
  unavailableSelectedRate: null,
  loading: false,
  error: null,
};

const unconfiguredRates = {
  data: {
    integration: { enabled: true, configured: false },
    rates: [],
    unavailable_selected_rate: null,
  },
  integration: { enabled: true, configured: false },
  rates: [],
  unavailableSelectedRate: null,
  loading: false,
  error: null,
};

const createContract = (rateId: string | null): ContractDB => ({
  id: "contract-1",
  type: "Cambio Compañía",
  province: "Madrid",
  city: "Madrid",
  address: "Calle Mayor 1",
  postal_code: "28001",
  old_company: "other-id",
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
  rate_id: rateId,
});

type FormKind = "creation" | "edition";

const renderForm = (
  kind: FormKind,
  contract: ContractDB,
  onSave: (savedContract: ContractDB) => void,
) => {
  if (kind === "creation") {
    return render(
      <ContractForm
        contract={contract}
        tramite_id="tramite-1"
        onCreateContract={onSave}
        onCancel={vi.fn()}
      />,
    );
  }

  return render(
    <EditContractForm
      contract={contract}
      onSavingContract={onSave}
      onCancel={vi.fn()}
    />,
  );
};

describe.each<FormKind>(["creation", "edition"])(
  "%s contract rate validation",
  (kind) => {
    beforeEach(() => {
      mocks.useActiveEnergySuppliers.mockReturnValue(supplierHookResult());
      mocks.useImaginaRates.mockReturnValue(configuredRates);
    });

    test("blocks an unresolved supplier id while suppliers are loading", () => {
      mocks.useActiveEnergySuppliers.mockReturnValue(
        supplierHookResult([], true),
      );
      const onSave = vi.fn();
      renderForm(kind, createContract("rate-1"), onSave);

      const submit = screen.getByRole("button", { name: "Guardar" });
      expect(submit).toBeDisabled();
      expect(
        screen.getByText(
          "Espera a que termine de cargarse la comercializadora seleccionada.",
        ),
      ).toBeInTheDocument();

      fireEvent.click(submit);

      expect(onSave).not.toHaveBeenCalled();
      expect(mocks.useImaginaRates).toHaveBeenLastCalledWith({
        enabled: false,
        historicalRateId: "rate-1",
      });
    });

    test("blocks an unresolved supplier id when supplier loading fails", () => {
      mocks.useActiveEnergySuppliers.mockReturnValue(
        supplierHookResult([], false, "No se pudieron cargar proveedores"),
      );
      const onSave = vi.fn();
      renderForm(kind, createContract("rate-1"), onSave);

      const submit = screen.getByRole("button", { name: "Guardar" });
      expect(submit).toBeDisabled();
      expect(
        screen.getByText(
          "No se ha podido verificar la comercializadora seleccionada. No se pudieron cargar proveedores",
        ),
      ).toBeInTheDocument();

      fireEvent.click(submit);
      expect(onSave).not.toHaveBeenCalled();
    });

    test("blocks a missing supplier id after a successful load until a valid supplier is selected", () => {
      const onSave = vi.fn();
      const contract = {
        ...createContract("rate-1"),
        new_company: "missing-supplier-id",
      };
      renderForm(kind, contract, onSave);

      const blockedSubmit = screen.getByRole("button", { name: "Guardar" });
      expect(blockedSubmit).toBeDisabled();
      expect(
        screen.getByText(
          "La comercializadora seleccionada no está disponible. Selecciona una comercializadora de la lista.",
        ),
      ).toBeInTheDocument();

      fireEvent.click(blockedSubmit);
      expect(onSave).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText("Compañía Nueva"), {
        target: { value: "other-id" },
      });
      const enabledSubmit = screen.getByRole("button", { name: "Guardar" });
      expect(enabledSubmit).toBeEnabled();

      fireEvent.click(enabledSubmit);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          new_company: "other-id",
          rate_id: null,
        }),
      );
    });

    test("clears a residual rate when changing between non-Imagina suppliers", () => {
      const onSave = vi.fn();
      const contract = {
        ...createContract("residual-rate"),
        new_company: "other-id",
      };
      renderForm(kind, contract, onSave);

      fireEvent.change(screen.getByLabelText("Compañía Nueva"), {
        target: { value: "third-id" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          new_company: "third-id",
          rate_id: null,
        }),
      );
    });

    test("activates Imagina validation after the supplier id resolves", () => {
      mocks.useActiveEnergySuppliers.mockReturnValue(
        supplierHookResult([], true),
      );
      const onSave = vi.fn();
      renderForm(kind, createContract("rate-1"), onSave);

      mocks.useActiveEnergySuppliers.mockReturnValue(supplierHookResult());
      fireEvent.change(screen.getByLabelText("Provincia"), {
        target: { value: "Barcelona" },
      });

      expect(mocks.useImaginaRates).toHaveBeenLastCalledWith({
        enabled: true,
        historicalRateId: "rate-1",
      });
      expect(
        screen.getByRole("button", { name: "Elegir tarifa vigente" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ rate_id: "rate-1" }),
      );
    });

    test("blocks an unavailable rate and shows its inline error", () => {
      const onSave = vi.fn();
      renderForm(kind, createContract("legacy-rate"), onSave);

      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

      expect(onSave).not.toHaveBeenCalled();
      expect(
        screen.getByText("La tarifa seleccionada ya no está disponible."),
      ).toBeInTheDocument();
    });

    test("accepts a current rate and keeps the original historical id stable", () => {
      const onSave = vi.fn();
      renderForm(kind, createContract("legacy-rate"), onSave);

      fireEvent.click(
        screen.getByRole("button", { name: "Elegir tarifa vigente" }),
      );

      expect(mocks.useImaginaRates).toHaveBeenLastCalledWith({
        enabled: true,
        historicalRateId: "legacy-rate",
      });

      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ rate_id: "rate-1" }),
      );
    });

    test("does not add rate validation for a confirmed unconfigured tenant", () => {
      mocks.useImaginaRates.mockReturnValue(unconfiguredRates);
      const onSave = vi.fn();
      renderForm(kind, createContract(null), onSave);

      expect(
        screen.queryByRole("button", { name: "Elegir tarifa vigente" }),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ rate_id: null }),
      );
    });

    test("clears the rate and its error when leaving Imagina", () => {
      const onSave = vi.fn();
      renderForm(kind, createContract("legacy-rate"), onSave);

      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
      expect(
        screen.getByText("La tarifa seleccionada ya no está disponible."),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Compañía Nueva"), {
        target: { value: "other-id" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          new_company: "other-id",
          rate_id: null,
        }),
      );

      fireEvent.change(screen.getByLabelText("Compañía Nueva"), {
        target: { value: "imagina-id" },
      });
      expect(
        screen.queryByText("La tarifa seleccionada ya no está disponible."),
      ).not.toBeInTheDocument();
    });
  },
);
