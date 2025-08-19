import { User } from "@/core/types";
import { Objective } from "../types/dashboard.types";

export const createEmptyObjective = (userData: User): Objective => ({
  id: `OBJ-${crypto.randomUUID()}`,
  type: "tramites",
  peak: 0,
  current: 0,
  period: "",
  created_at: new Date().toISOString(),
  completed: false,
  user_id: userData ? userData.id : "",
});
