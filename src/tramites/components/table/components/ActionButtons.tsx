"use client";

import { Download, PlusCircle } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { ColumnSelector } from "../ColumnSelector";
import AddTramiteDialog from "../../createTramite/AddTramiteDialog";
import CreateBajaModal from "../../createBaja/CreateBajaModal";
import { UpdateMultipleTramitesModal } from "../../liquidez/UpdateMultipleTramitesModal";
import { ImportExcelLiquidezModal } from "../../liquidez/ImportExcelLiquidezModal";
import ExportTableModal from "@/core/components/ExportTableModal";
import TooltipComponent from "@/core/components/TooltipComponent";
import type { Table } from "@tanstack/react-table";
import type { User } from "@/core/types";

interface ActionButtonsProps<TData> {
  table: Table<TData>;
  userData: User;
  isTramitesTable: boolean;
  isLiquidezTable: boolean;
  title: string;
}

export function ActionButtons<TData>({
  table,
  userData,
  isTramitesTable,
  isLiquidezTable,
  title,
}: ActionButtonsProps<TData>) {
  const isComercial = userData?.role === "2";

  return (
    <div className="flex items-center gap-3">
      {/* Column Selector */}
      <ColumnSelector
        table={table}
        tableId={
          isTramitesTable ? "tramites" : isLiquidezTable ? "liquidez" : ""
        }
      />

      {/* Export Button */}
      {!isComercial && (
        <Popover>
          <TooltipComponent content="Exportar datos">
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipComponent>
          <PopoverContent className="p-0 w-fit">
            <ExportTableModal table={table} name={title} />
          </PopoverContent>
        </Popover>
      )}

      {/* Update Multiple Tramites Modal for Liquidez */}
      {isLiquidezTable && (
        <>
          <ImportExcelLiquidezModal />
          <UpdateMultipleTramitesModal
            table={table}
            userData={userData as User}
          />
        </>
      )}

      {/* Create Button */}
      {isTramitesTable && (
        <Popover>
          <TooltipComponent content="Crear nuevo trámite">
            <PopoverTrigger asChild>
              <Button className="bg-primary-600 hover:bg-primary-700 text-white border-0 px-4 transition-colors">
                <PlusCircle className="h-4 w-4 mr-2" />
                Nuevo
              </Button>
            </PopoverTrigger>
          </TooltipComponent>
          <PopoverContent
            align="end"
            className="flex flex-col p-2 gap-2 w-full"
          >
            <AddTramiteDialog />
            {!isComercial && <CreateBajaModal />}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
