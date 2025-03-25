"use client";
import { FilterX, Columns } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { Table } from "@tanstack/react-table";
import { Tooltip } from "@heroui/tooltip";

interface ColumnSelectorProps<TData> {
  table: Table<TData>;
}

export function ColumnSelector<TData>({ table }: ColumnSelectorProps<TData>) {
  return (
    <DropdownMenu>
      <Tooltip content="Seleccionar columnas">
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 bg-gray-50 border-gray-200"
          >
            <Columns className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuItem
              key={column.id}
              className="capitalize"
              onSelect={() => column.toggleVisibility(!column.getIsVisible())}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
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

export function FilterButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      onClick={onPress}
      disabled={disabled}
      variant="destructive"
      className="max-w-44 w-full justify-between border border-danger text-danger-500"
    >
      <span>Eliminar Filtros</span>
      <FilterX className="h-4 w-4" />
    </Button>
  );
}
