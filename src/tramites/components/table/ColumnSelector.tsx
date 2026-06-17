"use client";
import { Columns } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu";
import { Button } from "@/core/components/ui/button";

import { Table } from "@tanstack/react-table";
import { useEffect } from "react";
import TooltipComponent from "@/core/components/TooltipComponent";

interface ColumnSelectorProps<TData> {
  table: Table<TData>;
  tableId: string; // Identificador único para cada tabla
}

export function ColumnSelector<TData>({
  table,
  tableId,
}: ColumnSelectorProps<TData>) {
  // Cargamos el estado inicial desde localStorage cuando el componente se monta
  useEffect(() => {
    const savedColumnVisibility = localStorage.getItem(
      `table-columns-${tableId}`
    );

    if (savedColumnVisibility) {
      try {
        const parsedColumnVisibility = JSON.parse(savedColumnVisibility);
        // Aplicamos la configuración guardada
        table.setColumnVisibility(parsedColumnVisibility);
      } catch (error) {
        console.error("Error al cargar la configuración de columnas:", error);
      }
    }
  }, [table, tableId]);

  // Guardar en localStorage cuando cambia la visibilidad
  const toggleColumnVisibility = (columnId: string, isVisible: boolean) => {
    const newVisibility = {
      ...table.getState().columnVisibility,
      [columnId]: isVisible,
    };

    // Actualizamos la tabla
    table.setColumnVisibility(newVisibility);

    // Guardamos en localStorage
    localStorage.setItem(
      `table-columns-${tableId}`,
      JSON.stringify(newVisibility)
    );
  };

  // Verificar si hay columnas ocultas
  const hasHiddenColumns = () => {
    const hideableColumns = table
      .getAllColumns()
      .filter((column) => column.getCanHide());
    return hideableColumns.some((column) => !column.getIsVisible());
  };

  // Contador de columnas ocultas
  const getHiddenColumnsCount = () => {
    return table
      .getAllColumns()
      .filter((column) => column.getCanHide() && !column.getIsVisible()).length;
  };

  // Determinar las clases para el botón según el estado
  const buttonClasses = hasHiddenColumns()
    ? "h-10 w-10 bg-blue-50 border-blue-200"
    : "h-10 w-10 bg-gray-50 border-gray-200";

  return (
    <DropdownMenu>
      <TooltipComponent
        content={
          hasHiddenColumns()
            ? `${getHiddenColumnsCount()} columnas ocultas`
            : "Seleccionar columnas"
        }
      >
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className={buttonClasses}>
            <div className="relative">
              <Columns className="h-4 w-4" />
              {hasHiddenColumns() && (
                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500" />
              )}
            </div>
          </Button>
        </DropdownMenuTrigger>
      </TooltipComponent>
      <DropdownMenuContent align="end" className="w-56">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuItem
              key={column.id}
              className="capitalize"
              onSelect={(e) => {
                e.preventDefault();
                toggleColumnVisibility(column.id, !column.getIsVisible());
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="Mostrar columna"
                  checked={column.getIsVisible()}
                  onChange={() => {}}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {column.id}
              </div>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

