"use client";

import { useState, useEffect } from "react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import { Download, FileX, Loader2 } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { exportRowsToExcel, exportToExcel } from "@/core/utils/export";
import { showCustomToast } from "./CustomToast";

interface ColumnOption {
  id: string;
  label: string;
  selected: boolean;
}

/** Outcome of fetching every filtered row from the server. */
export type ServerExportOutcome =
  | { status: "ok"; rows: Record<string, unknown>[] }
  | { status: "limit"; total: number; limit: number }
  | { status: "error"; message: string };

export interface ServerExportConfig {
  /** Columns offered by the export only — they have no counterpart in the table. */
  virtualColumns: { id: string; label: string }[];
  /** Fetches every row matching the active filters, not just the visible page. */
  fetchRows: (options: {
    includeNotes: boolean;
  }) => Promise<ServerExportOutcome>;
}

interface Props<TData> {
  table: Table<TData>;
  name: string;
  /**
   * When provided, the export pulls every filtered row from the server instead
   * of exporting the rows currently rendered.
   */
  serverExport?: ServerExportConfig;
}

/** Columns that carry UI affordances rather than data. */
const NON_EXPORTABLE_COLUMNS = ["actions", "select"];

export default function ExportTableModal<TData>({
  table,
  name,
  serverExport,
}: Props<TData>) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Actualiza las columnas cuando el modal se abre o la tabla cambia
  useEffect(() => {
    if (open && table) {
      // Solo actualiza las columnas cuando el modal está abierto
      const tableColumns = table
        .getAllColumns()
        .filter((column) => !NON_EXPORTABLE_COLUMNS.includes(column.id))
        .map((column) => ({
          id: column.id,
          label: column.id,
          selected: column.getIsVisible(),
        }));

      const virtualColumns = (serverExport?.virtualColumns ?? []).map(
        (column) => ({ ...column, selected: true }),
      );

      setColumns([...tableColumns, ...virtualColumns]);
    }
  }, [open, table, serverExport]);

  const handleColumnToggle = (columnId: string) => {
    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === columnId
          ? { ...column, selected: !column.selected }
          : column
      )
    );
  };

  const handleSelectAll = (select: boolean) => {
    setColumns((prevColumns) =>
      prevColumns.map((column) => ({ ...column, selected: select }))
    );
  };

  const selectedCount = columns.filter((column) => column.selected).length;
  const totalCount = columns.length;

  const notifyError = (message: string) =>
    showCustomToast({
      title: "Error",
      message,
      iconColor: "var(--danger-color)",
      iconSize: 24,
      icon: FileX,
    });

  const handleExport = async () => {
    const selectedColumnIds = columns
      .filter((column) => column.selected)
      .map((column) => column.id);

    setIsExporting(true);

    try {
      const result = serverExport
        ? await runServerExport(selectedColumnIds)
        : await exportToExcel({ table, selectedColumnIds, name });

      // A null result means the server export already reported the problem.
      if (!result) return;

      if (!result.success) {
        notifyError(result.error ?? "Error al exportar a Excel");
        return;
      }

      showCustomToast({
        title: "Éxito",
        message: `Se han exportado ${selectedCount} columnas a Excel`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: FileX,
      });

      setOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  /** Fetches every filtered row, then writes the workbook from that data. */
  const runServerExport = async (selectedColumnIds: string[]) => {
    if (!serverExport) return null;

    const includeNotes = selectedColumnIds.some((columnId) =>
      serverExport.virtualColumns.some((column) => column.id === columnId),
    );

    const outcome = await serverExport.fetchRows({ includeNotes });

    if (outcome.status === "limit") {
      notifyError(
        `Hay ${outcome.total.toLocaleString("es-ES")} resultados y el máximo por exportación es ${outcome.limit.toLocaleString("es-ES")}. Afina los filtros e inténtalo de nuevo.`,
      );
      return null;
    }

    if (outcome.status === "error") {
      notifyError(outcome.message);
      return null;
    }

    return exportRowsToExcel({
      table,
      rows: outcome.rows,
      selectedColumnIds,
      name,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="bg-success-500 px-4 text-white font-medium"
        >
          <FileX className="size-6" />
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Exportar {name}</DialogTitle>
          <DialogDescription>
            {serverExport
              ? "Selecciona las columnas que deseas exportar. Se exportarán todos los registros que cumplan los filtros activos."
              : "Selecciona las columnas que deseas exportar"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {selectedCount} de {totalCount} columnas seleccionadas
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectAll(true)}
                disabled={selectedCount === totalCount || totalCount === 0}
              >
                Seleccionar Todo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectAll(false)}
                disabled={selectedCount === 0 || totalCount === 0}
              >
                Limpiar Selección
              </Button>
            </div>
          </div>

          {totalCount > 0 ? (
            <div className="max-h-[300px] overflow-y-auto pr-2">
              <div className="space-y-3">
                {columns.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`column-${column.id}`}
                      checked={column.selected}
                      onCheckedChange={() => handleColumnToggle(column.id)}
                    />
                    <Label
                      htmlFor={`column-${column.id}`}
                      className="flex-1 cursor-pointer capitalize"
                    >
                      {column.label
                        .replace(/([A-Z])/g, " $1")
                        .replace(/_/g, " ")
                        .trim()}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground">
              No hay columnas para exportar
            </div>
          )}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedCount === 0 || isExporting}
            className="mt-2 sm:mt-0"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting
              ? "Exportando..."
              : `Exportar ${selectedCount} ${
                  selectedCount === 1 ? "columna" : "columnas"
                }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
