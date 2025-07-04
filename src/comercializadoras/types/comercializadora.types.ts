import { DocumentacionFile } from "@/core/types";

export interface ComercializadoraVM {
  id: string;
  name: string;
  active: boolean;
  logo: string | null;
  num_tramites: number;
  num_files: number;
}

export interface ComercializadoraDetails extends ComercializadoraVM {
  files: DocumentacionFile[];
  rates: Rate[];
}

export interface Rate {
  id: string;
  name: string;
  type: "fijo" | "indexado";
  price: number;
  created_at: string;
  updated_at: string | null;
  comercializadora_id: string;
}
