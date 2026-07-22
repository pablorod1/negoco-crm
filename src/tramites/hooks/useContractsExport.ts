import { useMemo } from "react";
import type { ServerExportConfig } from "@/core/components/ExportTableModal";
import { NOTES_COLUMN_ID } from "@/core/utils/export";
import {
  buildContractsQueryParams,
  type ContractsQueryFilters,
} from "@/tramites/utils/buildContractsQueryParams";

/**
 * Wires the tramites/liquidez export modal to the server-side export endpoint,
 * so the workbook covers every filtered record instead of the visible page and
 * can carry the "Notas" column (quick notes) that the table does not render.
 */
export function useContractsExport(
  filters: ContractsQueryFilters,
): ServerExportConfig {
  return useMemo(
    () => ({
      virtualColumns: [{ id: NOTES_COLUMN_ID, label: "Notas" }],
      fetchRows: async ({ includeNotes }) => {
        try {
          const params = buildContractsQueryParams(filters);
          if (includeNotes) params.append("includeNotes", "true");

          const res = await fetch(
            `/api/v2/contracts/export?${params.toString()}`,
          );
          const body = await res.json();

          if (res.status === 413) {
            return {
              status: "limit",
              total: Number(body?.total ?? 0),
              limit: Number(body?.limit ?? 0),
            };
          }

          if (!res.ok || !body?.success) {
            return {
              status: "error",
              message: body?.error || "Error al obtener los datos a exportar",
            };
          }

          return { status: "ok", rows: body.data ?? [] };
        } catch (error) {
          console.error("Error al obtener los datos a exportar:", error);
          return {
            status: "error",
            message: "Error al obtener los datos a exportar",
          };
        }
      },
    }),
    [filters],
  );
}
