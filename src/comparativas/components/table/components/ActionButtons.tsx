"use client";

import { Download } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { ColumnSelector } from "@/tramites/components/table/ColumnSelector";
import AddComparativaDialog from "../../createComparativa/AddComparativaDialog";
import ExportTableModal from "@/core/components/ExportTableModal";
import TooltipComponent from "@/core/components/TooltipComponent";
import type { Table } from "@tanstack/react-table";
import type { User } from "@/core/types";

interface ActionButtonsProps<TData> {
  table: Table<TData>;
  userData: User;
}

export function ActionButtons<TData>({
  table,
  userData,
}: ActionButtonsProps<TData>) {
  const isComercial = userData?.role === "2";

  return (
    <div className="flex items-center gap-3">
      {/* Column Selector */}
      <ColumnSelector table={table} tableId="comparativas" />

      {/* Export Button */}
      {!isComercial && (
        <Popover>
          <TooltipComponent content="Exportar datos">
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <Download className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipComponent>
          <PopoverContent className="p-0 w-fit">
            <ExportTableModal table={table} name="Comparativas" />
          </PopoverContent>
        </Popover>
      )}

      {/* Add Comparativa Button */}
      <AddComparativaDialog />
    </div>
  );
}
