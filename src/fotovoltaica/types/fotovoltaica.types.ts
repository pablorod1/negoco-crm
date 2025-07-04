import { User } from "@/core/types";

// Fotovoltaica related types
export type FotovoltaicaType = "PPA" | "renting" | "cubierta" | "";
export type FotovoltaicaClientType = "company" | "public_org" | "community";
export type FotovoltaicaStatus =
  | "pending"
  | "processing"
  | "completed"
  | "rejected";

export interface FotovoltaicaDB {
  id: string;
  type: FotovoltaicaType;
  client: string;
  client_type: FotovoltaicaClientType;
  location: string;
  coordinates: [number, number] | null;
  creation_date: string;
  activation_date: string | null;
  status: FotovoltaicaStatus;
  notes: string[];
  internal_notes: string[];
  comision: number;
  comision_sales_person: number;
  user_id: string;
}

export interface FotovoltaicaVM extends FotovoltaicaDB {
  files: FotovoltaicaFile[];
  user: Partial<User>;
  updated_by: Partial<User> | null;
  updated_at: string | null;
}

export interface FotovoltaicaFile {
  id: string;
  fotovoltaica_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
}
