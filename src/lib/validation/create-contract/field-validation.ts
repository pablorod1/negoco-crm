import {
  isCUPSWellFormed,
  isPostalCodeWellFormed,
  isStringValueInformed,
} from "../plane-validation";
import { FieldValidationResult } from "../validation.model";

export const validateField = (field: string): FieldValidationResult => {
  if (!isStringValueInformed(field)) {
    return {
      succeeded: false,
      errorMessage: "Este campo es obligatorio",
    };
  }

  return {
    succeeded: true,
  };
};

export const validatePostalCode = (
  postalCode: string
): FieldValidationResult => {
  if (!isStringValueInformed(postalCode)) {
    return {
      succeeded: false,
      errorMessage: "Este campo es obligatorio",
    };
  }

  if (!isPostalCodeWellFormed(postalCode)) {
    return {
      succeeded: false,
      errorMessage: "El código postal no es válido",
    };
  }

  return {
    succeeded: true,
  };
};

export const validateCUPSField = (field: string): FieldValidationResult => {
  if (!isStringValueInformed(field)) {
    return {
      succeeded: false,
      errorMessage: "Este campo es obligatorio",
    };
  }

  if (!isCUPSWellFormed(field)) {
    return {
      succeeded: false,
      errorMessage: "El CUPS debe tener 20 caracteres",
    };
  }

  return {
    succeeded: true,
  };
};
