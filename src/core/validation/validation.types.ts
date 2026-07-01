import { DocumentType, User } from "@/core/types";
import { ComparativaVM } from "@/comparativas/types";

export type FirstForm = {
  sales_name: string;
  user_id: string;
};

export const createEmptyFirstForm = (
  userData: User,
  comparativa?: ComparativaVM,
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
  tipo_via_cnmc?: string | null;
  calle?: string | null;
  numero_finca?: string | null;
  aclarador_finca?: string | null;
  phone_prefix?: string | null;
  cnae?: string | null;
}

export const createEmptySecondForm = (
  comparativa?: ComparativaVM,
): SecondForm => {
  const abarca = comparativa?.abarca_estudio;
  return {
    type: abarca?.nif_empresa ? "Empresa" : "Particular",
    document_type: abarca ? (abarca.nif_empresa ? "CIF" : "DNI") : "",
    document_number: abarca?.dni || "",
    name: abarca?.titular || (comparativa ? comparativa.client : ""),
    last_name: abarca?.ape1
      ? [abarca.ape1, abarca.ape2].filter(Boolean).join(" ")
      : "",
    email: abarca?.email || "",
    phone: abarca?.movil || "",
    IBAN: abarca?.iban || "",
    address: abarca
      ? [abarca.calle, abarca.numero].filter(Boolean).join(" ")
      : "",
    postal_code: abarca?.codpostal || "",
    province: "",
    city: abarca?.localidad || "",
    tipo_via_cnmc: null,
    calle: abarca?.calle || null,
    numero_finca: abarca?.numero || null,
    aclarador_finca: null,
    phone_prefix: "34",
    cnae: null,
  };
};

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
  document_type?: string | null;
  document_number: string;
  phone_prefix?: string | null;
  cargo: string;
}

export const createEmptySignerForm = (): SignerForm => ({
  name: "",
  last_name: "",
  email: "",
  phone: "",
  document_type: "DNI",
  document_number: "",
  phone_prefix: "34",
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
