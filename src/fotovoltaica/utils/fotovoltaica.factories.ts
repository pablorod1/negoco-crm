import { User } from "@/core/types";
import { FotovoltaicaDB } from "../types/fotovoltaica.types";

export const createEmptyFotovoltaicaDB = (userData: User): FotovoltaicaDB => ({
  id: `FOT-${crypto.randomUUID()}`,
  type: "PPA",
  client: "",
  client_type: "company",
  location: "",
  coordinates: null,
  creation_date: new Date().toISOString(),
  activation_date: null,
  status: "pending",
  notes: [],
  internal_notes: [],
  comision: 0,
  comision_sales_person: 0,
  user_id: userData ? userData.id : "",
});
