"use client";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { Plus } from "lucide-react";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import AddComparativaDialog from "@/comparativas/components/createComparativa/AddComparativaDialog";
import AddFotovoltaicaDialog from "@/fotovoltaica/components/createFotovoltaica/AddFotovoltaicaDialog";
import { useUser } from "@/core/contexts/UserContext";
import { cn } from "../utils";

export default function ShortcutsMenu({ open }: { open?: boolean }) {
  const { getPlan } = useUser();
  const isStarterPlan = getPlan() === "starter";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size={open ? "default" : "icon"}
          variant="ghost"
          className={cn(
            "transition-all duration-200",
            open
              ? "w-full justify-between bg-gray-50 hover:bg-gray-100 text-gray-700"
              : "w-6 h-6 bg-gray-50 hover:bg-gray-100 text-gray-600"
          )}
        >
          {open ? (
            <>
              <span className="text-sm font-medium">Acciones Rápidas</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
              </div>
            </>
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        className="w-72 p-0 rounded-xl border border-gray-200 shadow-lg"
        align="start"
      >
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="font-medium text-gray-900 text-sm">
            Acciones Rápidas
          </h4>
          <p className="text-xs text-gray-500 mt-1">Crear nuevo contenido</p>
        </div>

        <div className="p-2 space-y-1">
          <AddTramiteDialog shortcut />
          {!isStarterPlan && (
            <>
              <AddComparativaDialog shortcut />
              <AddFotovoltaicaDialog shortcut />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
