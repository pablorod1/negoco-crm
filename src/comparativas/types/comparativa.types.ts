import { User } from "@/core/types";
import { AbarcaEstudio } from "./abarca.types";

// Comparativa related types
export type ComparativaStatus =
  | "pending"
  | "awaiting_review"
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
  company_id?: string; // ID reference to comercializadoras table
}

// Enhanced comparativa with supplier information
export interface ComparativaWithSupplierDB extends ComparativaDB {
  company_id: string; // Required for completed comparativas
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
  company_id?: string; // ID reference to comercializadoras table
  company_name?: string; // Resolved name for display purposes
  abarca_estudio?: AbarcaEstudio; // Datos del estudio de Abarca si existe
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
  company_id?: string; // Resolved name for display purposes
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
