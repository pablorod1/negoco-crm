import type { ComparativaPlan, ComparativaVM } from "@/comparativas/types";

export function hasAssignedAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function completeCommissionPlans(row: Record<string, unknown>) {
  return {
    fijo: hasAssignedAmount(row.comision_fijo) && hasAssignedAmount(row.comision_sales_person_fijo),
    indexado: hasAssignedAmount(row.comision_indexado) && hasAssignedAmount(row.comision_sales_person_indexado),
  };
}

export function eligibleComparisonPlans(comparison: ComparativaVM): ComparativaPlan[] {
  return comparison.plan.filter((plan) =>
    comparison.has_complete_commissions?.[plan] ??
    (hasAssignedAmount(comparison.comision[plan]) && hasAssignedAmount(comparison.comision_sales_person[plan])),
  );
}
