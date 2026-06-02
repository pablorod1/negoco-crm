"use client";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import { Check, Pencil, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { useState } from "react";
import TooltipComponent from "@/core/components/TooltipComponent";
import { User } from "@/core/types";

interface Props {
  user: User;
}

export default function EditUserConfigModal({ user }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commissionPct, setCommissionPct] = useState("");
  const [defaultNotes, setDefaultNotes] = useState("");

  const handleOpen = () => {
    setCommissionPct(
      (user as User & { commission_pct?: number | null }).commission_pct != null
        ? String((user as User & { commission_pct?: number | null }).commission_pct)
        : "",
    );
    setDefaultNotes(
      (user as User & { default_notes?: string | null }).default_notes ?? "",
    );
    setIsOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (commissionPct !== "") {
        payload.commission_pct = parseFloat(commissionPct);
      } else {
        payload.commission_pct = null;
      }
      payload.default_notes = defaultNotes;

      const res = await fetch(`/api/v2/users/${user.id}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showCustomToast({
          title: "Error",
          message: data.error || "Error al guardar la configuración",
          icon: Pencil,
          iconSize: 24,
          iconColor: "red",
        });
        return;
      }

      showCustomToast({
        title: "Configuración actualizada",
        message: "Los cambios se han guardado correctamente",
        icon: Check,
        iconSize: 24,
        iconColor: "green",
      });

      setIsOpen(false);
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error desconocido al guardar la configuración",
        icon: Pencil,
        iconSize: 24,
        iconColor: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <TooltipComponent color="bg-primary" content="Configuración">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={handleOpen}
          >
            <Settings2 size={14} />
          </Button>
        </TooltipComponent>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md border-gray-200"
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Settings2 className="text-blue-600" size={20} />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Configuración de {user.name}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="commission_pct">% Comisión</Label>
            <Input
              id="commission_pct"
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="Ej: 15"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_notes">Notas predefinidas</Label>
            <Input
              id="default_notes"
              type="text"
              placeholder="Notas por defecto para contratos"
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
