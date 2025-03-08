export type TramiteDB = {
  id: string;
  creation_date: string;
  tramitation_date: string;
  activation_date: string;
  renovation_date: string;
  sales_name: string;
  comision_sales_person: number;
  comision: number;
  status: Status;
  liquidez_status: LiquidezStatus;
  notes: string | string[];
  client_id: string;
  user_id: string;
};

export const createEmptyTramiteDB = (userData: User): TramiteDB => ({
  id: `BEE-${Math.floor(Math.random() * 10000)}`,
  creation_date: new Date().toISOString(),
  tramitation_date: "",
  renovation_date: "",
  activation_date: "",
  sales_name: "",
  comision_sales_person: 0,
  comision: 0,
  status: "Borrador",
  liquidez_status: null,
  notes: [], // Ensure notes is initialized as an empty array
  client_id: "",
  user_id: userData ? userData.id : "",
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
  IBAN: string;
};

export const createEmptyClientDB = (): ClientDB => ({
  id: `CLI-${Math.floor(Math.random() * 10000)}`,
  name: "",
  last_name: "",
  type: "",
  email: "",
  phone: "",
  address: "",
  document_type: "",
  document_number: "",
  IBAN: "",
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
  id: `SGN-${Math.floor(Math.random() * 10000)}`,
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
  id: `CTR-${Math.floor(Math.random() * 10000)}`,
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

export type TramiteFile = {
  id: string;
  tramite_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
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

export type DocumentacionFile = {
  id: string;
  name: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
  folder_name: string;
  type: "file" | "folder";
};

export type TramiteVM = {
  id: string;
  creation_date: string;
  renovation_date: string;
  sales_name: string;
  client_name: string;
  client_email: string;
  client_id: string;
  CUPS: string[];
  company: string[];
  plan: string[];
  contract_type: string[];
  consumption: number[];
  comision_sales_person: number;
  comision: number;
  status: string;
  liquidez_status: string;
};

export type EditTramiteFormData = {
  tramite: TramiteDB;
  client: ClientDB;
  contracts: ContractDB[];
  signer: SignerDB;
  files?: TramiteFile[];
};

export const createEmptyTramiteForm = (
  userData: User
): EditTramiteFormData => ({
  tramite: createEmptyTramiteDB(userData),
  client: createEmptyClientDB(),
  contracts: [],
  signer: createEmptySignerDB(),
  files: [],
});

export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  created_at: string;
  updated_at: string;
  banned: boolean;
  image: string | null;
  organization: Organization;
  role: string;
  super_id: string | null;
  should_reset_password: boolean;
  notifications?: number;
}

export interface Organization {
  id: string;
  name: string;
  logo: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  context: string;
  link: string;
  priority: number;
  user_id: string;
}

export interface ComparativaDB {
  id: string;
  client: string;
  service: "Luz" | "Gas";
  plan: ComparativaPlan[];
  comision: {
    fijo: number;
    indexado: number;
  };
  comision_sales_person: {
    fijo: number;
    indexado: number;
  };
  notes: string[];
  user_id: string;
  creation_date: string;
  status: ComparativaStatus;
  tramite_id: string | undefined;
}

export const createEmptyComparativaDB = (userData: User): ComparativaDB => ({
  id: `CMP-${Math.floor(Math.random() * 10000)}`,
  client: "",
  service: "Luz",
  plan: [],
  comision: {
    fijo: 0,
    indexado: 0,
  },
  comision_sales_person: {
    fijo: 0,
    indexado: 0,
  },
  notes: [],
  user_id: userData ? userData.id : "",
  creation_date: new Date().toISOString(),
  status: "pending",
  tramite_id: undefined,
});

export interface ComparativaVM {
  id: string;
  client: string;
  service: "Luz" | "Gas";
  plan: ComparativaPlan[];
  comision: {
    fijo: number;
    indexado: number;
  };
  comision_sales_person: {
    fijo: number;
    indexado: number;
  };
  notes: string[];
  user: Partial<User>;
  creation_date: string;
  status: ComparativaStatus;
  tramite_id: string | undefined;
  files: Partial<ComparativaFile>[];
}

export interface ComparativaRow {
  id: string;
  client: string;
  service: "Luz" | "Gas";
  plan: ComparativaPlan[];
  comision: {
    fijo: number;
    indexado: number;
  };
  comision_sales_person: {
    fijo: number;
    indexado: number;
  };
  user: User;
  creation_date: string;
  status: ComparativaStatus;
}

export type ComparativaFile = {
  id: string;
  comparativa_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
};

export type ComparativaPlan = "fijo" | "indexado";

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

export type ComparativaStatus = "pending" | "completed" | "processed";

export type Cargo =
  | "Presidente de la Comunidad"
  | "Administrador de Fincas"
  | null;

export type DocumentType = "DNI" | "NIE" | "CIF" | "Otro" | "";

export type TimeRange =
  | "year"
  | "current_month"
  | "current_week"
  | "last_week"
  | "90d"
  | undefined;
