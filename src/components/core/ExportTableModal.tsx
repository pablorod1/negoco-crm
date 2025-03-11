"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileX } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { exportToExcel } from "@/lib/core/export";

interface ColumnOption {
  id: string;
  label: string;
  selected: boolean;
}

interface Props<TData> {
  table: Table<TData>;
  name: string;
}

export default function ExportTableModal<TData>({ table, name }: Props<TData>) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnOption[]>([]);

  // Actualiza las columnas cuando el modal se abre o la tabla cambia
  useEffect(() => {
    if (open && table) {
      // Solo actualiza las columnas cuando el modal está abierto
      const tableColumns = table
        .getAllColumns()
        .filter((column) => column.id !== "actions")
        .map((column) => ({
          id: column.id,
          label: column.id,
          selected: column.getIsVisible(),
        }));
      setColumns(tableColumns);
    }
  }, [open, table]);

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

  const handleExport = async () => {
    const selectedColumnIds = columns
      .filter((column) => column.selected)
      .map((column) => column.id);

    // Ejecuta la función de exportación personalizada si se proporciona
    await exportToExcel({ table, selectedColumnIds, name });

    setOpen(false);
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
          <DialogTitle>Export Table Data</DialogTitle>
          <DialogDescription>
            Select the columns you want to include in the export.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {selectedCount} of {totalCount} columns selected
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectAll(true)}
                disabled={selectedCount === totalCount || totalCount === 0}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectAll(false)}
                disabled={selectedCount === 0 || totalCount === 0}
              >
                Deselect All
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
                      {column.id
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
              No columns available for export
            </div>
          )}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedCount === 0}
            className="mt-2 sm:mt-0"
          >
            <Download className="mr-2 h-4 w-4" />
            Export {selectedCount} {selectedCount === 1 ? "column" : "columns"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
