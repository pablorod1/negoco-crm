"use client";

import React from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Label } from "@/core/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";
import { FileX } from "lucide-react";

interface ColumnOption {
  id: string;
  label: string;
  selected: boolean;
}

const ALL_COLUMNS: ColumnOption[] = [
  { id: "comercial", label: "Comercial", selected: true },
  { id: "client_fullname", label: "Cliente", selected: true },
  { id: "company", label: "Compañía", selected: true },
  { id: "cups", label: "CUPS", selected: true },
  { id: "activationDate", label: "Fecha de Activación", selected: true },
  { id: "renovationDate", label: "Fecha de Renovación", selected: true },
];

interface Props {
  currentDate: Date;
  userData: User;
}

export default function RenewableExportModal({ currentDate, userData }: Props) {
  const [open, setOpen] = React.useState(false);
  const [columns, setColumns] = React.useState<ColumnOption[]>(ALL_COLUMNS);
  const [isExporting, setIsExporting] = React.useState(false);

  // Reset columns to default when modal opens
  React.useEffect(() => {
    if (open) {
      setColumns(ALL_COLUMNS.map((c) => ({ ...c })));
    }
  }, [open]);

  const handleColumnToggle = (columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, selected: !col.selected } : col,
      ),
    );
  };

  const handleSelectAll = (select: boolean) => {
    setColumns((prev) => prev.map((col) => ({ ...col, selected: select })));
  };

  const selectedCount = columns.filter((c) => c.selected).length;
  const totalCount = columns.length;

  const formatDateValue = (value: string | null | undefined): string => {
    if (!value) return "---";
    try {
      return format(new Date(value), "dd/MM/yyyy");
    } catch {
      return value;
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const month = currentDate.getMonth() + 1; // 1-indexed
      const year = currentDate.getFullYear();

      const res = await fetch("/api/v2/contracts/renewable/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userData.id,
          role: userData.role,
          month,
          year,
        }),
      });

      const { success, data, error } = await res.json();

      if (!success || !data) {
        throw new Error(error || "Error al obtener los datos");
      }

      const selectedColumnIds = columns
        .filter((c) => c.selected)
        .map((c) => c.id);

      // Build column header map
      const headerMap: Record<string, string> = Object.fromEntries(
        ALL_COLUMNS.map((c) => [c.id, c.label]),
      );

      // Build worksheet rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = data.map((row: Record<string, any>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out: Record<string, any> = {};
        for (const colId of selectedColumnIds) {
          const header = headerMap[colId] ?? colId;
          if (colId === "activationDate" || colId === "renovationDate") {
            out[header] = formatDateValue(row[colId]);
          } else {
            out[header] = row[colId] || "---";
          }
        }
        return out;
      });

      const monthLabel = format(currentDate, "MMMM_yyyy", { locale: es });
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Renovaciones");
      XLSX.writeFile(workbook, `Renovaciones_${monthLabel}.xlsx`);

      showCustomToast({
        title: "Exportado",
        message: `${data.length} renovación${data.length !== 1 ? "es" : ""} exportadas`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: FileSpreadsheet,
      });

      setOpen(false);
    } catch (err) {
      showCustomToast({
        title: "Error",
        message: err instanceof Error ? err.message : "Error al exportar",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: FileX,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: es });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Exportar mes a Excel"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">
            Exportar {monthLabel}
          </DialogTitle>
          <DialogDescription>
            Selecciona las columnas que deseas exportar a Excel
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
                disabled={selectedCount === totalCount}
              >
                Seleccionar Todo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectAll(false)}
                disabled={selectedCount === 0}
              >
                Limpiar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {columns.map((column) => (
              <div key={column.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${column.id}`}
                  checked={column.selected}
                  onCheckedChange={() => handleColumnToggle(column.id)}
                />
                <Label
                  htmlFor={`col-${column.id}`}
                  className="flex-1 cursor-pointer"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
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
              : `Exportar ${selectedCount} ${selectedCount === 1 ? "columna" : "columnas"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
