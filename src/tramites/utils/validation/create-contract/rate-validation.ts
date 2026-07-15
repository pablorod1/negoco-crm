import type {
  ComercializadoraVM,
  ImaginaIntegrationStatus,
  ImaginaRate,
} from "@/comercializadoras/types";
import type { FieldValidationResult } from "@/core/validation/validation.model";

interface ImaginaRateValidationInput {
  isImaginaContract: boolean;
  rateId?: string | null;
  integration: ImaginaIntegrationStatus | null;
  rates: ImaginaRate[];
  loading: boolean;
  error?: string | null;
}

const normalizeSupplierName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

interface SupplierSelectionResolution {
  isImagina: boolean;
  blocked: boolean;
  errorMessage: string;
}

export const resolveSupplierSelection = (
  supplierSelection: string,
  suppliers: Pick<ComercializadoraVM, "id" | "name">[],
  loading: boolean,
  error?: string | null,
): SupplierSelectionResolution => {
  const trimmedSelection = supplierSelection.trim();
  const normalizedSelection = normalizeSupplierName(trimmedSelection);
  const supplier = suppliers.find(
    (candidate) =>
      candidate.id === trimmedSelection ||
      normalizeSupplierName(candidate.name) === normalizedSelection,
  );
  const isImagina =
    normalizeSupplierName(supplier?.name || trimmedSelection) ===
    "imagina energia";
  const unresolved = Boolean(trimmedSelection) && !supplier && !isImagina;

  if (unresolved && loading) {
    return {
      isImagina: false,
      blocked: true,
      errorMessage:
        "Espera a que termine de cargarse la comercializadora seleccionada.",
    };
  }

  if (unresolved && error) {
    return {
      isImagina: false,
      blocked: true,
      errorMessage: `No se ha podido verificar la comercializadora seleccionada. ${error}`,
    };
  }

  if (unresolved) {
    return {
      isImagina: false,
      blocked: true,
      errorMessage:
        "La comercializadora seleccionada no está disponible. Selecciona una comercializadora de la lista.",
    };
  }

  return { isImagina, blocked: false, errorMessage: "" };
};

export const rateMatchesId = (
  rate: ImaginaRate,
  rateId: string,
): boolean => rate.id === rateId || rate.external_rate_id === rateId;

export const validateImaginaRate = ({
  isImaginaContract,
  rateId,
  integration,
  rates,
  loading,
  error,
}: ImaginaRateValidationInput): FieldValidationResult => {
  if (!isImaginaContract) return { succeeded: true };

  if (loading) {
    return {
      succeeded: false,
      errorMessage: "Espera a que terminen de cargar las tarifas de Imagina.",
    };
  }

  if (error) {
    return {
      succeeded: false,
      errorMessage: `No se han podido cargar las tarifas de Imagina. ${error}`,
    };
  }

  if (!integration) {
    return {
      succeeded: false,
      errorMessage:
        "No se ha podido comprobar la configuración de tarifas de Imagina.",
    };
  }

  if (!integration.configured) return { succeeded: true };

  if (rates.length === 0) {
    return {
      succeeded: false,
      errorMessage: "No hay tarifas de Imagina disponibles.",
    };
  }

  const normalizedRateId = rateId?.trim();
  if (!normalizedRateId) {
    return {
      succeeded: false,
      errorMessage: "Selecciona una tarifa de Imagina.",
    };
  }

  if (!rates.some((rate) => rateMatchesId(rate, normalizedRateId))) {
    return {
      succeeded: false,
      errorMessage: "La tarifa seleccionada ya no está disponible.",
    };
  }

  return { succeeded: true };
};
