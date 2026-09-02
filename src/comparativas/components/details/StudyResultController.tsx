"use client";

import type { ReactNode } from "react";
import type { User } from "@/core/types";
import { hasPermission } from "@/core/access-control/client";
import { useStudyResult } from "@/comparativas/hooks/useStudyResult";
import { StudyResultDialog, type StudyResultController as Controller } from "./StudyResultDialog";

export function StudyResultController({ comparisonId, comparisonStatus, user, onRefresh, children }: {
  comparisonId: string; comparisonStatus: string; user: User; onRefresh: () => void; children: (controller: Controller) => ReactNode;
}) {
  const enabled = hasPermission(user.permissions, user.role, "comparisons.study.complete") || hasPermission(user.permissions, user.role, "comparisons.study.review");
  const controller = useStudyResult({ comparisonId, comparisonStatus, enabled, onRefresh });
  return <>
    {children(controller)}
    <StudyResultDialog controller={controller} role={user.role} />
  </>;
}
