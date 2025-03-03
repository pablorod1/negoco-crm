import { DocumentType, User } from "../core/types";

export type FirstForm = {
  sales_name: string;
  client_type: string;
  user_id: string;
};

export const createEmptyFirstForm = (userData: User): FirstForm => ({
  sales_name: userData.name,
  client_type: "",
  user_id: userData.id,
});

export type FirstFormError = {
  sales_name: string;
  client_type: string;
};

export const createEmptyFirstFormError = (): FirstFormError => ({
  sales_name: "",
  client_type: "",
});

export interface SecondForm {
  document_type: DocumentType;
  document_number: string;
  name: string;
  last_name: string;
  email: string;
  phone: string;
  IBAN: string;
  address: string;
}

export const createEmptySecondForm = (): SecondForm => ({
  document_type: "",
  document_number: "",
  name: "",
  last_name: "",
  email: "",
  phone: "",
  IBAN: "",
  address: "",
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
  company: string;
}

export const createEmptyContract = (): ContractForm => ({
  type: "",
  postal_code: "",
  province: "",
  city: "",
  address: "",
  CUPS: "",
  plan: "",
  company: "",
});

export interface ContractError {
  type: string;
  postal_code: string;
  province: string;
  city: string;
  address: string;
  CUPS: string;
  plan: string;
  company: string;
}

export const createEmptyContractError = (): ContractError => ({
  type: "",
  postal_code: "",
  province: "",
  city: "",
  address: "",
  CUPS: "",
  plan: "",
  company: "",
});
