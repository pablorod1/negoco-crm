"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Percent, TriangleAlert, X } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import TooltipComponent from "@/core/components/TooltipComponent";
import { CommissionType } from "@/core/types";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useDefaultCompanyCommissions } from "@/core/hooks/use-default-company-commissions";

type DefaultDraft = {
  commission_type: CommissionType;
  commission_value: string;
};

interface Props {
  onSaved?: () => void;
}

/**
 * Define la comisión por defecto de la asesoría para cada comercializadora.
 * Todos los colaboradores sin comisión personalizada heredan estos valores, así
 * que cambiar un porcentaje aquí lo cambia para todos de una vez.
 */
export default function CommissionDefaultsModal({ onSaved }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DefaultDraft>>({});
  const [bulkType, setBulkType] = useState<CommissionType>("percent");
  const [bulkValue, setBulkValue] = useState("");

  const { activeSuppliers, loading: suppliersLoading } =
    useActiveEnergySuppliers();
  const {
    defaults,
    loading: defaultsLoading,
    refetch,
  } = useDefaultCompanyCommissions(isOpen);

  const defaultsBySupplier = useMemo(
    () =>
      new Map(defaults.map((fallback) => [fallback.comercializadora_id, fallback])),
    [defaults],
  );

  /** Lo editado por el usuario si ya tocó la fila; si no, lo guardado en servidor. */
  const resolveDraft = useCallback(
    (supplierId: string): DefaultDraft => {
      const draft = drafts[supplierId];
      if (draft) return draft;

      const fallback = defaultsBySupplier.get(supplierId);
      return {
        commission_type: fallback?.commission_type ?? "percent",
        commission_value: fallback ? String(fallback.commission_value) : "",
      };
    },
    [defaultsBySupplier, drafts],
  );

  const definedCount = useMemo(
    () =>
      activeSuppliers.filter(
        (supplier) => resolveDraft(supplier.id).commission_value.trim() !== "",
      ).length,
    [activeSuppliers, resolveDraft],
  );

  const initializing = suppliersLoading || defaultsLoading;

  const updateDraft = (supplierId: string, patch: Partial<DefaultDraft>) => {
    setDrafts((current) => ({
      ...current,
      [supplierId]: { ...resolveDraft(supplierId), ...patch },
    }));
  };

  const handleOpenChange = (open: boolean) => {
    // Al cerrar se descartan los cambios sin guardar: la próxima apertura vuelve
    // a partir de lo que hay en servidor.
    if (!open) {
      setDrafts({});
      setBulkValue("");
    }
    setIsOpen(open);
  };

  const applyToAll = () => {
    if (bulkValue.trim() === "") return;
    setDrafts(
      Object.fromEntries(
        activeSuppliers.map((supplier) => [
          supplier.id,
          { commission_type: bulkType, commission_value: bulkValue },
        ]),
      ),
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = activeSuppliers
        .map((supplier) => ({ supplier, draft: resolveDraft(supplier.id) }))
        .filter(({ draft }) => draft.commission_value.trim() !== "")
        .map(({ supplier, draft }) => ({
          comercializadora_id: supplier.id,
          commission_type: draft.commission_type,
          commission_value: Number(draft.commission_value) || 0,
        }));

      const res = await fetch("/api/v2/commissions/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: payload }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showCustomToast({
          title: "Error",
          message: data.error || "Error al guardar las comisiones por defecto",
          icon: TriangleAlert,
          iconSize: 24,
          iconColor: "red",
        });
        return;
      }

      showCustomToast({
        title: "Comisiones por defecto actualizadas",
        message:
          "Se aplican a todos los colaboradores sin comisión personalizada",
        icon: Check,
        iconSize: 24,
        iconColor: "green",
      });
      await refetch();
      onSaved?.();
      handleOpenChange(false);
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error desconocido al guardar las comisiones por defecto",
        icon: TriangleAlert,
        iconSize: 24,
        iconColor: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-gray-200">
          <Percent size={16} className="mr-2" />
          Comisiones por defecto
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-3xl border-gray-200 p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 py-5 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Percent className="text-blue-600" size={20} />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Comisiones por defecto
              </DialogTitle>
              <p className="text-sm text-gray-500">
                Se aplican a todos los colaboradores que no tengan una comisión
                personalizada
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto p-6 space-y-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <Label className="text-sm text-gray-700">
              Aplicar el mismo valor a todas las comercializadoras
            </Label>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3">
              <Select
                value={bulkType}
                onValueChange={(value: CommissionType) => setBulkType(value)}
                disabled={loading || initializing}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="fixed">Fijo</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step={0.01}
                className="bg-white"
                placeholder="Ej. 15"
                value={bulkValue}
                onChange={(event) => setBulkValue(event.target.value)}
                disabled={loading || initializing}
              />
              <Button
                type="button"
                variant="outline"
                className="border-gray-200 bg-white"
                onClick={applyToAll}
                disabled={loading || initializing || bulkValue.trim() === ""}
              >
                Rellenar todas
              </Button>
            </div>
          </div>

          {initializing ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              Cargando comercializadoras...
            </div>
          ) : activeSuppliers.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              No hay comercializadoras activas.
            </div>
          ) : (
            <div className="space-y-2">
              {activeSuppliers.map((supplier) => {
                const draft = resolveDraft(supplier.id);
                const isDefined = draft.commission_value.trim() !== "";
                return (
                  <div
                    key={supplier.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_40px] gap-3 items-center rounded-2xl bg-gray-50 p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate">
                        {supplier.name}
                      </div>
                      {!isDefined && (
                        <span className="text-xs text-gray-400">
                          Sin comisión por defecto
                        </span>
                      )}
                    </div>
                    <Select
                      value={draft.commission_type}
                      onValueChange={(value: CommissionType) =>
                        updateDraft(supplier.id, { commission_type: value })
                      }
                      disabled={loading}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">Fijo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="bg-white"
                      placeholder="Sin definir"
                      value={draft.commission_value}
                      onChange={(event) =>
                        updateDraft(supplier.id, {
                          commission_value: event.target.value,
                        })
                      }
                      disabled={loading}
                    />
                    <TooltipComponent
                      color="bg-primary"
                      content="Quitar comisión por defecto"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() =>
                          updateDraft(supplier.id, { commission_value: "" })
                        }
                        disabled={loading || !isDefined}
                      >
                        <X size={16} />
                      </Button>
                    </TooltipComponent>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-3 px-6 py-4 border-t border-gray-100 bg-white sm:justify-between">
          <span className="text-sm text-gray-500 self-center">
            {definedCount} de {activeSuppliers.length} comercializadoras con
            valor por defecto
          </span>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading || initializing}
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
