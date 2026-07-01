import {
  FieldValidationResult,
  FormValidationResult,
} from "@/core/validation/validation.model";
import {
  validateCUPSField,
  validateField,
  validatePostalCode,
} from "./field-validation";
import {
  ContractError,
  ContractForm,
} from "@/core/validation/validation.types";

export const validateContract = (
  contract: ContractForm
): FormValidationResult<ContractError> => {
  const fieldValidationResults: FieldValidationResult[] = [
    validateField(contract.type),
    validatePostalCode(contract.postal_code),
    validateField(contract.province),
    validateField(contract.city),
    validateField(contract.address),
    validateCUPSField(contract.CUPS),
    validateField(contract.plan),
    validateField(contract.new_company),
  ];

  const formValidationResult: FormValidationResult<ContractError> = {
    succeeded: fieldValidationResults.every((f) => f.succeeded),
    errors: {
      type: fieldValidationResults[0].errorMessage || "",
      postal_code: fieldValidationResults[1].errorMessage || "",
      province: fieldValidationResults[2].errorMessage || "",
      city: fieldValidationResults[3].errorMessage || "",
      address: fieldValidationResults[4].errorMessage || "",
      CUPS: fieldValidationResults[5].errorMessage || "",
      plan: fieldValidationResults[6].errorMessage || "",
      new_company: fieldValidationResults[7].errorMessage || "",
    },
  };

  return formValidationResult;
};
