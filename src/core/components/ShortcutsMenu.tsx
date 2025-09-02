"use client";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { Zap, FileText, Sun, BarChart3, Grip } from "lucide-react";
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
          className={cn("gap-4", open ? "justify-between" : "mx-auto")}
        >
          {open ? (
            <>
              <span className="">Acciones Rápidas</span>
              <div className="grid grid-cols-3 gap-1.5 bg-gray-100/80 rounded-full py-1 px-3">
                <FileText className="w-2 h-2 text-pending-700" />
                <BarChart3 className="w-2 h-2 text-green-700" />
                <Sun className="w-2 h-2 text-warning-700" />
              </div>
            </>
          ) : (
            <Grip className="w-5 h-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-80 p-0" align="start">
        <div className="px-4 py-3 border-b bg-gray-50/50">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            Acciones Rápidas
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Selecciona una acción para comenzar
          </p>
        </div>

        <div className="space-y-2 p-2">
          <AddTramiteDialog shortcut />
          {!isStarterPlan ? (
            <>
              <AddComparativaDialog shortcut />
              <AddFotovoltaicaDialog shortcut />
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
