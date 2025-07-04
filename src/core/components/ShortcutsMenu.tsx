"use client";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { Zap, Grip } from "lucide-react";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import AddComparativaDialog from "@/comparativas/components/createComparativa/AddComparativaDialog";
import AddFotovoltaicaDialog from "@/fotovoltaica/components/createFotovoltaica/AddFotovoltaicaDialog";
import { useUser } from "@/core/contexts/UserContext";

export default function ShortcutsMenu() {
  const { getPlan } = useUser();
  const isStarterPlan = getPlan() === "starter";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Grip className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center">
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
