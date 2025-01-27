export type TramiteDB = {
  id: string;
  creation_date: string;
  tramitation_date: string;
  renovation_date: string;
  sales_name: string;
  comision_sales: number;
  comision: number;
  status: Status;
  liquidez_status: LiquidezStatus;
  notes: string[];
  client_id: string;
  user_id: string;
};

export const createEmptyTramiteDB = (): TramiteDB => ({
  id: "",
  creation_date: new Date().toISOString(),
  tramitation_date: "",
  renovation_date: "",
  sales_name: "",
  comision_sales: 0,
  comision: 0,
  status: "Borrador",
  liquidez_status: null,
  notes: [],
  client_id: "",
  user_id: "",
});

export type ClientDB = {
  id: string;
  name: string;
  last_name: string;
  email: string;
  type: string;
  phone: string;
  address: string;
  document_type: string;
  document_number: string;
  user_id: string;
};

export const createEmptyClientDB = (): ClientDB => ({
  id: "",
  name: "",
  last_name: "",
  type: "",
  email: "",
  phone: "",
  address: "",
  document_type: "",
  document_number: "",
  user_id: "",
});

export type SignerDB = {
  id: string;
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  cargo: string | null;
  client_id: string;
};

export const createEmptySignerDB = (): SignerDB => ({
  id: "",
  name: "",
  last_name: "",
  email: "",
  phone: "",
  document_number: "",
  cargo: null,
  client_id: "",
});

export type ContractDB = {
  id: string;
  type: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  company: string;
  plan: string;
  consumption: number;
  CUPS: string;
  pot1: number;
  pot2: number;
  pot3: number;
  pot4: number;
  pot5: number;
  pot6: number;
  description: string;
  tramite_id: string;
};

export const createEmptyContractDB = (): ContractDB => ({
  id: "",
  type: "",
  province: "",
  city: "",
  address: "",
  postal_code: "",
  company: "",
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

export type Status =
  | "Borrador"
  | "Tramitable"
  | "Verificado"
  | "Pendiente de Firma"
  | "Procesando"
  | "Activo"
  | "Baja";

export type LiquidezStatus =
  | "Pendiente de Cobro"
  | "Cobrado por Comercializadora"
  | "Pagado al Comercial"
  | null;

export type Cargo =
  | "Presidente de la Comunidad"
  | "Administrador de Fincas"
  | null;

export type DocumentType = "DNI" | "NIE" | "CIF" | "Otro" | "";
