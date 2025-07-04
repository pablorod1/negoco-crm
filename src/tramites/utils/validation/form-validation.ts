import {
  FirstForm,
  FirstFormError,
  SecondForm,
  SecondFormError,
  SignerForm,
  SignerFormError,
} from "@/core/validation/validation.types";
import {
  validateDocumentField,
  validateEmailField,
  validateField,
  validateIBANField,
  validatePhoneField,
} from "./field-validation";

import {
  FormValidationResult,
  FieldValidationResult,
} from "@/core/validation/validation.model";

export const firstFormValidation = (
  tramite: FirstForm
): FormValidationResult<FirstFormError> => {
  const fieldValidationResults: FieldValidationResult[] = [
    validateField(tramite.sales_name),
    validateField(tramite.user_id),
  ];

  const formValidationResult: FormValidationResult<FirstFormError> = {
    succeeded: fieldValidationResults.every((f) => f.succeeded),
    errors: {
      sales_name: fieldValidationResults[0].errorMessage || "",
      user_id: fieldValidationResults[1].errorMessage || "",
    },
  };

  return formValidationResult;
};

export const secondFormValidation = (
  tramite: SecondForm
): FormValidationResult<SecondFormError> => {
  const fieldValidationResults: FieldValidationResult[] = [
    validateField(tramite.document_type),
    validateDocumentField(tramite.document_number, tramite.document_type),
    validateField(tramite.name),
    validateEmailField(tramite.email),
    validatePhoneField(tramite.phone),
    validateIBANField(tramite.IBAN),
    validateField(tramite.address),
  ];

  const formValidationResult: FormValidationResult<SecondFormError> = {
    succeeded: fieldValidationResults.every((f) => f.succeeded),
    errors: {
      document_type: fieldValidationResults[0].errorMessage || "",
      document_number: fieldValidationResults[1].errorMessage || "",
      name: fieldValidationResults[2].errorMessage || "",
      email: fieldValidationResults[3].errorMessage || "",
      phone: fieldValidationResults[4].errorMessage || "",
      IBAN: fieldValidationResults[5].errorMessage || "",
      address: fieldValidationResults[6].errorMessage || "",
    },
  };

  return formValidationResult;
};

export const signerFormValidation = (
  signer: SignerForm
): FormValidationResult<SignerFormError> => {
  const fieldValidationResults: FieldValidationResult[] = [
    validateField(signer.name),
    validateField(signer.last_name),
    validateEmailField(signer.email),
    validatePhoneField(signer.phone),
    validateDocumentField(signer.document_number, "DNI"),
  ];

  const formValidationResult: FormValidationResult<SignerFormError> = {
    succeeded: fieldValidationResults.every((f) => f.succeeded),
    errors: {
      name: fieldValidationResults[0].errorMessage || "",
      last_name: fieldValidationResults[1].errorMessage || "",
      email: fieldValidationResults[2].errorMessage || "",
      phone: fieldValidationResults[3].errorMessage || "",
      document_number: fieldValidationResults[4].errorMessage || "",
    },
  };

  return formValidationResult;
};
