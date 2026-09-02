import { User } from "@/core/types";
import { ComparativaDB } from "../types/comparativa.types";

export const createEmptyComparativaDB = (userData: User): ComparativaDB => ({
  id: `CMP-${crypto.randomUUID()}`,
  client: "",
  service: "Luz",
  plan: ["fijo"],
  comision: {
    fijo: null,
    indexado: null,
  },
  comision_sales_person: {
    fijo: null,
    indexado: null,
  },
  notes: [],
  user_id: userData ? userData.id : "",
  creation_date: new Date().toISOString(),
  status: "pending",
  tramite_id: undefined,
  has_permanencia: 0,
  has_renovacion: 0,
});
