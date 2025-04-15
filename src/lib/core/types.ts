export type TramiteDB = {
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
  client_id: string;
  user_id: string;
};

export interface TramiteVM extends TramiteDB {
  user: Partial<User>;
  updated_by: Partial<User> | null;
  updated_at: string | null;
}

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
  client_id: "",
  user_id: "",
  user: {},
  updated_by: null,
  updated_at: null,
});

export interface TramiteWithUser extends TramiteDB {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    image: string | null;
  };
}

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
  }-${Math.floor(Math.random() * 10000)}`,
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
  client_id: "",
  user_id: comparativa
    ? (comparativa.user.id as string)
    : userData
      ? userData.id
      : "",
});

export type ClientDB = {
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
};

export const createEmptyClientDB = (comparativa?: ComparativaVM): ClientDB => ({
  id: `CLI-${Math.floor(Math.random() * 10000)}`,
  name: comparativa ? comparativa.client : "",
  last_name: comparativa ? comparativa.client.split(" ")[1] || "" : "",
  type: "Particular",
  email: "",
  phone: "",
  address: "",
  postal_code: "",
  province: "",
  city: "",
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
};

export const createEmptyContractDB = (): ContractDB => ({
  id: `CTR-${Math.floor(Math.random() * 10000)}`,
  type: "",
  province: "",
  city: "",
  address: "",
  postal_code: "",
  old_company: "",
  new_company: "",
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

export type TramiteRow = {
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
};

export type EditTramiteFormData = {
  tramite: TramiteVM;
  client: ClientDB;
  contracts: ContractDB[];
  signer: SignerDB;
  files?: TramiteFile[];
};

export const createEmptyTramiteForm = (): EditTramiteFormData => ({
  tramite: createEmptyTramiteVM(),
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
  company: string | null;
  role: string;
  super_id: string | null;
  should_reset_password: boolean;
  notifications?: number;
  last_login?: string | null;
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
  plan: ["fijo"],
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

export interface Objective {
  id: string;
  type: ObjectiveType;
  peak: number;
  current: number;
  period: string;
  created_at: string;
  completed: boolean;
  user_id: string;
}

export const createEmptyObjective = (userData: User): Objective => ({
  id: `OBJ-${Math.floor(Math.random() * 10000)}`,
  type: "tramites",
  peak: 0,
  current: 0,
  period: "",
  created_at: new Date().toISOString(),
  completed: false,
  user_id: userData ? userData.id : "",
});

export type ObjectiveType = "comisiones" | "tramites" | "ratio";

export type Status =
  | "Borrador"
  | "Tramitable"
  | "Verificado"
  | "Pendiente de Firma"
  | "Procesando"
  | "Activo"
  | "Baja"
  | "Scoring";

export type LiquidezStatus =
  | "Pendiente de Cobro"
  | "Cobrado por Comercializadora"
  | "Pagado al Comercial"
  | "Pendiente de Descontar"
  | "Descontado"
  | null;

export type ComparativaStatus =
  | "pending"
  | "completed"
  | "processed"
  | "rejected";

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
