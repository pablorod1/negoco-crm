import { User } from "@/core/types";
import { Objective } from "../types/dashboard.types";

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
