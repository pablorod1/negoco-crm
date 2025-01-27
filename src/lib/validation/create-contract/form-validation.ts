import {
  FieldValidationResult,
  FormValidationResult,
} from "../validation.model";
import { validateField, validatePostalCode } from "./field-validation";
import { ContractError, ContractForm } from "@/lib/validation/validation.types";

export const validateContract = (
  contract: ContractForm
): FormValidationResult<ContractError> => {
  const fieldValidationResults: FieldValidationResult[] = [
    validateField(contract.type),
    validatePostalCode(contract.postal_code),
    validateField(contract.province),
    validateField(contract.city),
    validateField(contract.address),
    validateField(contract.CUPS),
    validateField(contract.plan),
    validateField(contract.company),
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
      company: fieldValidationResults[7].errorMessage || "",
    },
  };

  return formValidationResult;
};
