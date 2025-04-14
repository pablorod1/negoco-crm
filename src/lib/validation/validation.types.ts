import { ComparativaVM, DocumentType, User } from "../core/types";

export type FirstForm = {
  sales_name: string;
  user_id: string;
};

export const createEmptyFirstForm = (
  userData: User,
  comparativa?: ComparativaVM
): FirstForm => ({
  sales_name: comparativa ? (comparativa.user.name as string) : userData.name,
  user_id: userData.id,
});

export type FirstFormError = {
  sales_name: string;
  user_id: string;
};

export const createEmptyFirstFormError = (): FirstFormError => ({
  sales_name: "",
  user_id: "",
});

export interface SecondForm {
  type: string;
  document_type: DocumentType;
  document_number: string;
  name: string;
  last_name: string;
  email: string;
  phone: string;
  IBAN: string;
  address: string;
  postal_code: string;
  province: string;
  city: string;
}

export const createEmptySecondForm = (
  comparativa?: ComparativaVM
): SecondForm => ({
  type: "Particular",
  document_type: "",
  document_number: "",
  name: comparativa ? comparativa.client : "",
  last_name: "",
  email: "",
  phone: "",
  IBAN: "",
  address: "",
  postal_code: "",
  province: "",
  city: "",
});

export interface SecondFormError {
  document_type: string;
  document_number: string;
  name: string;
  email: string;
  phone: string;
  IBAN: string;
  address: string;
}

export const createEmptySecondFormError = (): SecondFormError => ({
  document_type: "",
  document_number: "",
  name: "",
  email: "",
  phone: "",
  IBAN: "",
  address: "",
});

export interface SignerForm {
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  cargo: string;
}

export const createEmptySignerForm = (): SignerForm => ({
  name: "",
  last_name: "",
  email: "",
  phone: "",
  document_number: "",
  cargo: "",
});

export interface SignerFormError {
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
}

export const createEmptySignerFormError = (): SignerFormError => ({
  name: "",
  last_name: "",
  email: "",
  phone: "",
  document_number: "",
});

export interface ContractForm {
  type: string;
  postal_code: string;
  province: string;
  city: string;
  address: string;
  CUPS: string;
  plan: string;
  new_company: string;
}

export const createEmptyContract = (): ContractForm => ({
  type: "",
  postal_code: "",
  province: "",
  city: "",
  address: "",
  CUPS: "",
  plan: "",
  new_company: "",
});

export interface ContractError {
  type: string;
  postal_code: string;
  province: string;
  city: string;
  address: string;
  CUPS: string;
  plan: string;
  new_company: string;
}

export const createEmptyContractError = (): ContractError => ({
  type: "",
  postal_code: "",
  province: "",
  city: "",
  address: "",
  CUPS: "",
  plan: "",
  new_company: "",
});
