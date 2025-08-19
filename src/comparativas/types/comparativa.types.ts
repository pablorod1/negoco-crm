import { User } from "@/core/types";

// Comparativa related types
export type ComparativaStatus =
  | "pending"
  | "completed"
  | "processed"
  | "rejected";

export type ComparativaPlan = "fijo" | "indexado";

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

export interface ComparativaFile {
  id: string;
  comparativa_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
}
