import { User } from "@/core/types";
import {
  TramiteDB,
  TramiteVM,
  ClientDB,
  SignerDB,
  ContractDB,
  TramiteFile,
  EditTramiteFormData,
} from "../types/tramite.types";
import { ComparativaVM } from "@/comparativas/types";

// Factory functions
export const createEmptyTramiteVM = (): TramiteVM => ({
  id: "",
  creation_date: "",
  tramitation_date: "",
  activation_date: "",
  renovation_date: "",
  collection_date: null,
  payment_date: null,
  sales_name: "",
  comision_sales_person: 0,
  comision: 0,
  status: "Borrador",
  liquidez_status: null,
  notes: [],
  internal_notes: [],
  client_id: "",
  user_id: "",
  user: {},
  updated_by: null,
  updated_at: null,
});

const getComission = (
  comparativa: ComparativaVM,
  plan: "fijo" | "indexado"
) => {
  return plan === "fijo"
    ? {
        comision: comparativa.comision.fijo,
        comision_sales_person: comparativa.comision_sales_person.fijo,
      }
    : {
        comision: comparativa.comision.indexado,
        comision_sales_person: comparativa.comision_sales_person.indexado,
      };
};

export const createEmptyTramiteDB = (
  userData: User,
  plan?: "fijo" | "indexado",
  comparativa?: ComparativaVM
): TramiteDB => ({
  id: `${
    userData ? userData.organization.name.slice(0, 3).toUpperCase() : "NEG"
  }-${crypto.randomUUID()}`,
  creation_date: new Date().toISOString(),
  tramitation_date: "",
  renovation_date: "",
  activation_date: "",
  payment_date: null,
  collection_date: null,
  sales_name: comparativa
    ? (comparativa.user.name as string)
    : userData
      ? userData.name
      : "",
  comision_sales_person:
    comparativa && plan
      ? getComission(comparativa, plan).comision_sales_person
      : 0,
  comision: comparativa && plan ? getComission(comparativa, plan).comision : 0,
  status: "Borrador",
  liquidez_status: null,
  notes: comparativa ? comparativa.notes : [],
  internal_notes: [],
  client_id: "",
  user_id: comparativa
    ? (comparativa.user.id as string)
    : userData
      ? userData.id
      : "",
});

export const createEmptyClientDB = (comparativa?: ComparativaVM): ClientDB => ({
  id: `CLI-${crypto.randomUUID()}`,
  name: comparativa ? comparativa.client : "",
  last_name: comparativa ? comparativa.client.split(" ")[1] || "" : "",
  type: "Particular",
  email: "",
  phone: "",
  address: "",
  postal_code: "",
  province: "",
  city: "",
  document_type: "DNI",
  document_number: "",
  IBAN: "",
  coordinates: null,
});

export const createEmptySignerDB = (): SignerDB => ({
  id: `SGN-${crypto.randomUUID()}`,
  name: "",
  last_name: "",
  email: "",
  phone: "",
  document_number: "",
  cargo: null,
  client_id: "",
});

export const createEmptyContractDB = (
  comparativa?: ComparativaVM | undefined
): ContractDB => ({
  id: `CTR-${crypto.randomUUID()}`,
  type: "",
  province: "",
  city: "",
  address: "",
  postal_code: "",
  old_company: "",
  new_company: comparativa ? comparativa.company_id || "" : "",
  plan: "",
  consumption: 0,
  CUPS: "",
  pot1: 0,
  pot2: 0,
  pot3: 0,
  pot4: 0,
  pot5: 0,
  pot6: 0,
  description: "",
  tramite_id: "",
});

export const createEmptyTramiteFile = (): TramiteFile => ({
  id: "",
  tramite_id: "",
  filename: "",
  size: 0,
  extension: "",
  upload_date: new Date().toISOString(),
  download_url: "",
  preview_url: null,
});

export const createEmptyTramiteForm = (): EditTramiteFormData => ({
  tramite: createEmptyTramiteVM(),
  client: createEmptyClientDB(),
  contracts: [],
  signer: createEmptySignerDB(),
  files: [],
});
