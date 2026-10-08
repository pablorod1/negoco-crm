import { useState } from "react";
import { Power, PowerOff } from "lucide-react";

import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { ComercializadoraVM } from "@/comercializadoras/types";

interface ComercializadorasBulkStatusProps {
  /** Comercializadoras visibles con los filtros actuales. */
  comercializadoras: ComercializadoraVM[];
  isFiltered: boolean;
  onConfirm: (active: boolean) => Promise<void>;
}

export function ComercializadorasBulkStatus({
  comercializadoras,
  isFiltered,
  onConfirm,
}: ComercializadorasBulkStatusProps) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const toActivate = comercializadoras.filter((c) => !c.active).length;
  const toDeactivate = comercializadoras.length - toActivate;
  const count = pending ? toActivate : toDeactivate;
  const verb = pending ? "activar" : "desactivar";

  const handleConfirm = async () => {
    if (pending === null) return;
    setSaving(true);
    try {
      await onConfirm(pending);
      setPending(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-2 sm:ml-auto">
      <Button
        variant="outline"
        size="sm"
        disabled={toActivate === 0}
        onClick={() => setPending(true)}
      >
        <Power />
        Activar todas
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={toDeactivate === 0}
        onClick={() => setPending(false)}
      >
        <PowerOff />
        Desactivar todas
      </Button>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && !saving && setPending(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              ¿{verb[0].toUpperCase() + verb.slice(1)} {count}{" "}
              {count === 1 ? "comercializadora" : "comercializadoras"}?
            </DialogTitle>
            <DialogDescription>
              {isFiltered
                ? "Solo se aplica a las comercializadoras que se muestran con la búsqueda y el filtro actuales."
                : "Se aplica a todas las comercializadoras."}{" "}
              {pending
                ? "Volverán a estar disponibles en formularios y filtros."
                : "Dejarán de estar disponibles en formularios y filtros."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setPending(null)}
            >
              Cancelar
            </Button>
            <Button disabled={saving} onClick={handleConfirm}>
              {saving ? "Guardando..." : `Sí, ${verb}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
