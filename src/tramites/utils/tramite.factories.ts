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
  plan: "fijo" | "indexado",
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
  comparativa?: ComparativaVM,
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
  plan: plan ? plan : null,
});

export const createEmptyClientDB = (comparativa?: ComparativaVM): ClientDB => {
  const abarca = comparativa?.abarca_estudio;
  return {
    id: `CLI-${crypto.randomUUID()}`,
    name: abarca?.titular || (comparativa ? comparativa.client : ""),
    last_name: abarca?.ape1
      ? [abarca.ape1, abarca.ape2].filter(Boolean).join(" ")
      : comparativa
        ? comparativa.client.split(" ")[1] || ""
        : "",
    type: abarca?.nif_empresa ? "Empresa" : "Particular",
    email: abarca?.email || "",
    phone: abarca?.movil || "",
    address: abarca
      ? [abarca.calle, abarca.numero].filter(Boolean).join(" ")
      : "",
    postal_code: abarca?.codpostal || "",
    province: "",
    city: abarca?.localidad || "",
    document_type: abarca?.nif_empresa ? "CIF" : "DNI",
    document_number: abarca?.dni || "",
    IBAN: abarca?.iban || "",
    coordinates: null,
  };
};

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
  comparativa?: ComparativaVM | undefined,
): ContractDB => {
  const abarca = comparativa?.abarca_estudio;

  // Determine contract type from Abarca data
  let type = "";
  if (abarca) {
    const empresaNorm = (abarca.empresa ?? "")
      .split(" - ")[0]
      .trim()
      .toLowerCase();
    const empresaClienteNorm = (abarca.empresa_cliente ?? "")
      .split(" - ")[0]
      .trim()
      .toLowerCase();
    const isDifferentCompany =
      empresaNorm && empresaClienteNorm && empresaNorm !== empresaClienteNorm;

    if (isDifferentCompany && abarca.cambio_titularidad) {
      type = "Cambio Compañía + Cambio Titular";
    } else if (isDifferentCompany) {
      type = "Cambio Compañía";
    }
  }

  // Sum consumos
  const totalConsumo = abarca
    ? (abarca.consumo_p1 ?? 0) +
      (abarca.consumo_p2 ?? 0) +
      (abarca.consumo_p3 ?? 0)
    : 0;

  return {
    id: `CTR-${crypto.randomUUID()}`,
    type,
    province: "",
    city: abarca?.localidad_cups || "",
    address: abarca
      ? [abarca.calle_cups, abarca.numero_cups].filter(Boolean).join(" ")
      : "",
    postal_code: abarca?.codpostal_cups || "",
    old_company: "",
    new_company: comparativa ? comparativa.company_id || "" : "",
    plan: abarca?.tipo_tarifa || "",
    consumption: totalConsumo,
    CUPS: abarca?.cups || "",
    pot1: abarca?.potencia_contratada ?? 0,
    pot2: abarca?.potencia_contratada_p2 ?? 0,
    pot3: 0,
    pot4: 0,
    pot5: 0,
    pot6: 0,
    description: "",
    tramite_id: "",
  };
};

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
