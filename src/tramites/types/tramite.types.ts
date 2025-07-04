import { User } from "@/core/types";

// Tramite related types
export type Status =
  | "Borrador"
  | "Tramitable"
  | "Verificado"
  | "Pendiente de Firma"
  | "Procesando"
  | "Activo"
  | "Baja"
  | "Scoring"
  | "Incidencia"
  | "KO";

export type LiquidezStatus =
  | "Pendiente de Cobro"
  | "Cobrado por Comercializadora"
  | "Pagado al Comercial"
  | "Pendiente de Descontar"
  | "Descontado"
  | null;

export type Cargo =
  | "Presidente de la Comunidad"
  | "Administrador de Fincas"
  | null;

export type DocumentType = "DNI" | "NIE" | "CIF" | "Otro" | "";

export interface TramiteDB {
  id: string;
  creation_date: string;
  tramitation_date: string;
  activation_date: string;
  renovation_date: string;
  collection_date: string | null;
  payment_date: string | null;
  sales_name: string;
  comision_sales_person: number;
  comision: number;
  status: Status;
  liquidez_status: LiquidezStatus;
  notes: string[];
  internal_notes: string[];
  client_id: string;
  user_id: string;
  rejected_date?: string | null;
}

export interface TramiteVM extends TramiteDB {
  user: Partial<User>;
  updated_by: Partial<User> | null;
  updated_at: string | null;
}

export interface TramiteWithUser extends TramiteDB {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    image: string | null;
  };
}

export interface TramiteFile {
  id: string;
  tramite_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
}

export interface TramiteRow {
  id: string;
  creation_date: string;
  activation_date: string;
  renovation_date: string;
  collection_date: string | null;
  payment_date: string | null;
  sales_name: string;
  client_name: string;
  client_email: string;
  client_id: string;
  CUPS: string[];
  old_company: string[];
  new_company: string[];
  plan: string[];
  contract_type: string[];
  consumption: number[];
  comision_sales_person: number;
  comision: number;
  status: string;
  liquidez_status: string;
}

export interface ClientDB {
  id: string;
  name: string;
  last_name: string;
  email: string;
  type: string;
  phone: string;
  address: string;
  postal_code: string;
  province: string;
  city: string;
  document_type: string;
  document_number: string;
  IBAN: string;
  coordinates: [number, number] | null;
}

export interface SignerDB {
  id: string;
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  cargo: string | null;
  client_id: string;
}

export interface ContractDB {
  id: string;
  type: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  old_company: string;
  new_company: string;
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
}

export interface EditTramiteFormData {
  tramite: TramiteVM;
  client: ClientDB;
  contracts: ContractDB[];
  signer: SignerDB;
  files?: TramiteFile[];
}
