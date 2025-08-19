export type ObjectiveType = "comisiones" | "tramites" | "ratio";

export type TimeRange =
  | "year"
  | "current_month"
  | "current_week"
  | "last_week"
  | "90d"
  | undefined;

export interface Objective {
  id: string;
  type: ObjectiveType;
  peak: number;
  current: number;
  period: string;
  created_at: string;
  completed: boolean;
  user_id: string;
}
