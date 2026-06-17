import { ComparativaVM } from "@/comparativas/types";

export function isEditableComparativa(
  comparativa: ComparativaVM | null,
  userRole?: string
): boolean {
  if (!comparativa || !userRole) return false;

  const isComercial = userRole === "2";
  const isEditable =
    !isComercial &&
    comparativa.status !== "processed" &&
    comparativa.status !== "rejected";

  return isEditable;
}

export function isComercialEditableComparativa(
  comparativa: ComparativaVM | null,
  userRole?: string
): boolean {
  if (!comparativa || !userRole) return false;

  const isComercial = userRole === "2";
  return isComercial && comparativa.status === "pending";
}

function isStudiedComparativa(
  comparativa: ComparativaVM | null
): boolean {
  return comparativa?.status === "completed";
}

export function isProcessedComparativa(
  comparativa: ComparativaVM | null
): boolean {
  return comparativa?.status === "processed";
}

export function hasNotesComparativa(
  comparativa: ComparativaVM | null
): boolean {
  return (comparativa?.notes?.length ?? 0) > 0;
}

function showCommissionsTab(
  comparativa: ComparativaVM | null,
  isSubcomercial: boolean
): boolean {
  if (!comparativa || isSubcomercial) return false;

  return (
    comparativa.status === "completed" || comparativa.status === "processed"
  );
}

export function isAdminUser(userRole?: string): boolean {
  return userRole === "admin";
}

function isBackOfficeUser(userRole?: string): boolean {
  return userRole === "1";
}
