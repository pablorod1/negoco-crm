export type StudyPlan = "fijo" | "indexado";
export type StudyCommissionDecision =
  | "keep"
  | "apply"
  | "offer_keep_sales"
  | "offer_clear_sales"
  | "manual";

export interface StudyResultDecision {
  resultId: string;
  revision: string;
  chosenType?: StudyPlan;
  planDecision: "none" | "add" | "replace";
  commissionDecision: StudyCommissionDecision;
  manualSales?: number;
}

export interface StudyResultAmounts {
  sales: number | null;
  /** Only present for admin / role 1. */
  agency?: number | null;
}

export interface StudyResultDTO {
  id: string;
  state: "pending" | "applied" | "resolved";
  receivedType: StudyPlan | null;
  chosenType: StudyPlan | null;
  typeOrigin: "received" | "user" | null;
  targetPlan: StudyPlan | null;
  plans: StudyPlan[];
  revision: string;
  pendingSteps: ("type" | "plan" | "commissions")[];
  hasExistingCommissions: boolean;
  offerAvailable: boolean;
  salesCalculable: boolean;
  current: StudyResultAmounts | null;
  proposed: StudyResultAmounts | null;
  capabilities: {
    canResolve: boolean;
    canChooseType: boolean;
    canManualSales: boolean;
    commissionDecisions: StudyCommissionDecision[];
  };
  resolution: {
    actorId: string | null;
    resolvedAt: string;
    planDecision: "none" | "add" | "replace";
    commissionDecision: StudyCommissionDecision;
    amounts: StudyResultAmounts | null;
  } | null;
}

export interface StudyResultResponse {
  success: true;
  comparisonStatus: string;
  data: StudyResultDTO | null;
}
