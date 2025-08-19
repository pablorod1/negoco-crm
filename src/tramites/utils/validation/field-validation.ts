import {
  isDocumetNumberWellFormed,
  isEmailWellFormed,
  isIBANWellFormed,
  isPhoneNumberWellFormed,
  isStringValueInformed,
} from "@/core/validation/plane-validation";
import { FieldValidationResult } from "@/core/validation/validation.model";

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

export const validateEmailField = (field: string): FieldValidationResult => {
  if (!isStringValueInformed(field)) {
    return {
      succeeded: false,
      errorMessage: "Este campo es obligatorio",
    };
  }

  if (!isEmailWellFormed(field)) {
    return {
      succeeded: false,
      errorMessage: "El email no es válido",
    };
  }

  return {
    succeeded: true,
  };
};

export const validatePhoneField = (field: string): FieldValidationResult => {
  if (!isStringValueInformed(field)) {
    return {
      succeeded: false,
      errorMessage: "Este campo es obligatorio",
    };
  }

  if (!isPhoneNumberWellFormed(field)) {
    return {
      succeeded: false,
      errorMessage: "El teléfono no es válido",
    };
  }

  return {
    succeeded: true,
  };
};

export const validateIBANField = (field: string): FieldValidationResult => {
  if (!isStringValueInformed(field)) {
    return {
      succeeded: false,
      errorMessage: "Este campo es obligatorio",
    };
  }

  if (!isIBANWellFormed(field)) {
    return {
      succeeded: false,
      errorMessage: "El IBAN no es válido",
    };
  }

  return {
    succeeded: true,
  };
};

export const validateDocumentField = (
  field: string,
  documentType: string
): FieldValidationResult => {
  if (!isStringValueInformed(field)) {
    return {
      succeeded: false,
      errorMessage: "Este campo es obligatorio",
    };
  }

  if (!isDocumetNumberWellFormed(documentType, field)) {
    return {
      succeeded: false,
      errorMessage: "El número de documento no es válido",
    };
  }

  return {
    succeeded: true,
  };
};
