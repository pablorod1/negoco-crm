import { User } from "@/core/types";
import { AbarcaEstudio, AbarcaWebhookDocument } from "./abarca.types";

// Comparativa related types
export type ComparativaStatus =
  | "pending"
  | "processing"
  | "awaiting_review"
  | "completed"
  | "processed"
  | "rejected"
  | "rechazado_cliente";

export type ComparativaPlan = "fijo" | "indexado";

export interface ComparativaDB {
  id: string;
  client: string;
  service: "Luz" | "Gas";
  plan: ComparativaPlan[];
  comision: {
    fijo: number | null;
    indexado: number | null;
  };
  comision_sales_person: {
    fijo: number | null;
    indexado: number | null;
  };
  notes: string[];
  user_id: string;
  creation_date: string;
  status: ComparativaStatus;
  tramite_id: string | undefined;
  company_id?: string; // ID reference to comercializadoras table
  has_permanencia: number;
  has_renovacion: number;
}

// Enhanced comparativa with supplier information
export interface ComparativaWithSupplierDB extends ComparativaDB {
  company_id: string; // Required for completed comparativas
}

export interface ComparativaVM {
  has_complete_commissions?: Record<ComparativaPlan, boolean>;
  has_pending_study_result?: boolean;
  id: string;
  client: string;
  service: "Luz" | "Gas";
  plan: ComparativaPlan[];
  comision: {
    fijo: number | null;
    indexado: number | null;
  };
  comision_sales_person: {
    fijo: number | null;
    indexado: number | null;
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
  abarca_documents?: AbarcaWebhookDocument[]; // Estado de los documentos del webhook
  has_permanencia: boolean;
  has_renovacion: boolean;
}

export interface ComparativaRow {
  has_complete_commissions?: Record<ComparativaPlan, boolean>;
  has_pending_study_result?: boolean;
  id: string;
  client: string;
  service: "Luz" | "Gas";
  plan: ComparativaPlan[];
  comision: {
    fijo: number | null;
    indexado: number | null;
  };
  comision_sales_person: {
    fijo: number | null;
    indexado: number | null;
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
