import type {
  ExcelImportNote,
  LiquidezStatus,
  MatchedCUPS,
} from "@/tramites/types";

/** Include selected trámites with notes even when their liquidity status stays the same. */
export function getProcessableCups(
  matchedCups: MatchedCUPS[],
  selectedIds: Set<string>,
  targetStatus: LiquidezStatus,
  newNotesByTramite: Record<string, ExcelImportNote[]>,
): MatchedCUPS[] {
  return matchedCups.filter(
    (item) =>
      selectedIds.has(item.cups) &&
      ((targetStatus != null && item.liquidezStatus !== targetStatus) ||
        (newNotesByTramite[item.tramiteId]?.length ?? 0) > 0),
  );
}
