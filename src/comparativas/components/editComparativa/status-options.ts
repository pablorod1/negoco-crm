import { COMPARATIVA_STATUS_TYPES } from "@/comparativas/constants";
import type { ComparativaStatus } from "@/comparativas/types/comparativa.types";
import { hasPermission } from "@/core/access-control/client";
import type { User } from "@/core/types";

export function getAllowedStatusOptions(
  currentStatus: ComparativaStatus,
  userData: Pick<User, "role" | "permissions">,
  hasTramite = false,
) {
  const canCompleteStudy = hasPermission(
    userData.permissions,
    userData.role,
    "comparisons.study.complete",
  );
  const canReviewStudy = hasPermission(
    userData.permissions,
    userData.role,
    "comparisons.study.review",
  );

  const allowedStatuses: ComparativaStatus[] = [];

  if (currentStatus === "pending" && canCompleteStudy) {
    allowedStatuses.push("completed", "rejected");
  } else if (currentStatus === "awaiting_review" && canReviewStudy) {
    allowedStatuses.push("completed");
  } else if (currentStatus === "completed") {
    if (hasTramite) allowedStatuses.push("processed");
    allowedStatuses.push("rechazado_cliente");
  } else if (
    (currentStatus === "rejected" || currentStatus === "rechazado_cliente") &&
    (userData.role === "admin" || userData.role === "1")
  ) {
    allowedStatuses.push("pending");
    if (canCompleteStudy) allowedStatuses.push("completed");
    allowedStatuses.push(
      currentStatus === "rejected" ? "rechazado_cliente" : "rejected",
    );
  }

  return COMPARATIVA_STATUS_TYPES.filter(({ value }) =>
    allowedStatuses.includes(value as ComparativaStatus),
  );
}

export function getStatusUpdatePayload({
  status,
  commissions,
  tramiteId,
}: {
  status: ComparativaStatus;
  commissions?: Record<string, number | undefined> | null;
  tramiteId?: string;
}) {
  return {
    status,
    comissions: commissions ?? undefined,
    tramite_id: status === "processed" ? tramiteId : undefined,
  };
}

export function hasMissingCommission(
  values: readonly (number | undefined)[],
): boolean {
  return values.some(
    (value) => typeof value !== "number" || !Number.isFinite(value),
  );
}
