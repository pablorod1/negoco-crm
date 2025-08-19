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
  plan: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  client?: string | undefined;
  created_at: string;
  context: string;
  link: string;
  priority: number;
  user_id: string;
}

export interface DocumentacionFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
  folder_name: string;
  type: "file" | "folder";
}

export type TimeRange =
  | "year"
  | "current_month"
  | "current_week"
  | "last_week"
  | "90d"
  | undefined;

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

export type ComparativaStatus =
  | "pending"
  | "completed"
  | "processed"
  | "rejected";

export type FotovoltaicaStatus =
  | "pending"
  | "processing"
  | "completed"
  | "rejected";

export type DocumentType = "DNI" | "NIE" | "CIF" | "Otro" | "";
export type FotovoltaicaType = "PPA" | "renting" | "cubierta" | "";
export type FotovoltaicaClientType = "company" | "public_org" | "community";
