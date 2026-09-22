"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
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
import {
  CommissionSegment,
  CommissionType,
  DefaultCompanyCommission,
} from "@/core/types";
import {
  COMMISSION_SEGMENTS,
  COMMISSION_SEGMENT_LABELS,
} from "@/core/utils/commission-segment";
import type { ComercializadoraVM } from "@/comercializadoras/types";

type DefaultDraft = {
  commission_type: CommissionType;
  commission_value: string;
};

interface Props {
  suppliers: ComercializadoraVM[];
  defaults: DefaultCompanyCommission[];
  segments: CommissionSegment[];
  loading: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => Promise<void> | void;
}

/**
 * Comisiones por defecto de la asesoría para cada comercializadora, editables
 * directamente (ya no viven en un modal). Todos los colaboradores sin override
 * heredan estos valores.
 */
export default function CommissionDefaultsEditor({
  suppliers,
  defaults,
  segments,
  loading,
  onDirtyChange,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DefaultDraft>>({});
  const [bulkType, setBulkType] = useState<CommissionType>("percent");
  const [bulkValue, setBulkValue] = useState("");
  const [search, setSearch] = useState("");

  const defaultsBySupplier = useMemo(
    () =>
      new Map(
        defaults.map((fallback) => [
          `${fallback.comercializadora_id}:${fallback.segment}`,
          fallback,
        ]),
      ),
    [defaults],
  );

  /** Lo editado por el usuario si ya tocó la fila; si no, lo guardado en servidor. */
  const resolveDraft = useCallback(
    (supplierId: string, segment: CommissionSegment): DefaultDraft => {
      const key = `${supplierId}:${segment}`;
      const draft = drafts[key];
      if (draft) return draft;

      const fallback = defaultsBySupplier.get(key);
      return {
        commission_type: fallback?.commission_type ?? "percent",
        commission_value: fallback ? String(fallback.commission_value) : "",
      };
    },
    [defaultsBySupplier, drafts],
  );

  const dirty = useMemo(
    () => Object.keys(drafts).length > 0,
    [drafts],
  );

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const visibleSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const invalid = Object.values(drafts).some((draft) =>
    draft.commission_value.trim() !== "" &&
    (!Number.isFinite(Number(draft.commission_value)) || Number(draft.commission_value) < 0),
  );

  const updateDraft = (supplierId: string, patch: Partial<DefaultDraft>) => {
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(segments.map((segment) => [
        `${supplierId}:${segment}`, { ...resolveDraft(supplierId, segment), ...patch },
      ])),
    }));
  };

  const applyToAll = () => {
    if (bulkValue.trim() === "") return;
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(
        visibleSuppliers.flatMap((supplier) => segments.map((segment) => [
          `${supplier.id}:${segment}`,
          { commission_type: bulkType, commission_value: bulkValue },
        ])),
      ),
    }));
  };

  const discard = () => {
    setDrafts({});
    setBulkValue("");
  };

  const handleSave = async () => {
    if (invalid || loading) return;
    setSaving(true);
    try {
      const activeIds = new Set(suppliers.map((supplier) => supplier.id));
      const retained = defaults.filter(
        (rule) =>
          !activeIds.has(rule.comercializadora_id) ||
          !drafts[`${rule.comercializadora_id}:${rule.segment}`],
      );
      const edited = suppliers.flatMap((supplier) =>
        COMMISSION_SEGMENTS.flatMap((ruleSegment) => {
          const draft = drafts[`${supplier.id}:${ruleSegment}`];
          if (!draft) return [];
          if (draft.commission_value.trim() === "") return [];
          return [
            {
              comercializadora_id: supplier.id,
              segment: ruleSegment,
              commission_type: draft.commission_type,
              commission_value: Number(draft.commission_value) || 0,
            },
          ];
        }),
      );
      const payload = [...retained, ...edited].map((rule) => ({
        comercializadora_id: rule.comercializadora_id,
        segment: rule.segment,
        commission_type: rule.commission_type,
        commission_value: rule.commission_value,
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
      setDrafts({});
      setBulkValue("");
      await onSaved();
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error desconocido al guardar las comisiones por defecto",
        icon: TriangleAlert,
        iconSize: 24,
        iconColor: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p role="status" className="p-8 text-center text-sm text-gray-500">Cargando comisiones...</p>;

  if (suppliers.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-1">
          Comisiones por defecto
        </h3>
        <p className="text-sm text-gray-500 py-6 text-center">
          No hay comercializadoras activas.
        </p>
      </div>
    );
  }

  return (
    <section className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Comisiones por defecto
          </h3>
          <p className="text-sm text-gray-500">
            La comisión que heredan los colaboradores sin personalización.
            Los cambios se guardan con el botón «Guardar cambios».
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
        <Label className="text-sm text-gray-700">
          Rellenar las comercializadoras {search.trim() ? "filtradas" : "con el mismo valor"}
        </Label>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3">
          <Select
            value={bulkType}
            onValueChange={(value: CommissionType) => setBulkType(value)}
            disabled={saving}
          >
            <SelectTrigger aria-label="Tipo de comisión para rellenar" className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Porcentaje %</SelectItem>
              <SelectItem value="fixed">Importe €</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            aria-label="Valor para rellenar"
            min={0}
            step={0.01}
            className="bg-white"
            placeholder="Ej. 15"
            value={bulkValue}
            onChange={(event) => setBulkValue(event.target.value)}
            disabled={saving}
          />
          <Button
            type="button"
            variant="outline"
            className="border-gray-200 bg-white"
            onClick={applyToAll}
            disabled={saving || bulkValue.trim() === "" || !Number.isFinite(Number(bulkValue)) || Number(bulkValue) < 0 || visibleSuppliers.length === 0}
          >
            Rellenar {search.trim() ? "filtradas" : "todas"}
          </Button>
        </div>
      </div>

      <Input type="search" aria-label="Buscar comercializadora" placeholder="Buscar comercializadora" value={search} onChange={(event) => setSearch(event.target.value)} className="sm:max-w-sm" />
      <div className="space-y-2">
        {visibleSuppliers.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No hay comercializadoras que coincidan con la búsqueda.</p>}
        {visibleSuppliers.map((supplier) => {
          const values = segments.map((segment) => resolveDraft(supplier.id, segment));
          const draft = values[0];
          const mixedType = values.some((value) => value.commission_type !== draft.commission_type);
          const mixedValue = values.some((value) => value.commission_value !== draft.commission_value);
          const isDefined = values.some((value) => value.commission_value.trim() !== "");
          return (
            <div
              key={supplier.id}
              className="grid grid-cols-[1fr_1fr_40px] md:grid-cols-[1fr_160px_160px_40px] gap-3 items-center rounded-2xl bg-gray-50 p-3"
            >
              <div className="col-span-3 min-w-0 md:col-span-1">
                <div className="font-medium text-sm text-gray-800 truncate">
                  {supplier.name}
                </div>
                {(mixedType || mixedValue) && <p className="text-xs text-amber-700">{mixedType ? "Elige primero un tipo común para editar el valor." : "Valores distintos · editar unifica los segmentos"}</p>}
                {segments.length > 1 && <p className="mt-1 text-xs text-gray-500">{segments.map((segment, index) => `${COMMISSION_SEGMENT_LABELS[segment]}: ${values[index].commission_value || "Sin definir"}${values[index].commission_value ? (values[index].commission_type === "percent" ? "%" : " €") : ""}`).join(" · ")}</p>}
                {!isDefined && (
                  <span className="text-xs text-gray-400">
                    Sin comisión por defecto
                  </span>
                )}
              </div>
              <Select
                value={mixedType ? "" : draft.commission_type}
                onValueChange={(value: CommissionType) =>
                  updateDraft(supplier.id, { commission_type: value })
                }
                disabled={saving}
              >
                <SelectTrigger aria-label={`Tipo de comisión de ${supplier.name}`} className="bg-white">
                  <SelectValue placeholder="Tipos distintos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentaje %</SelectItem>
                  <SelectItem value="fixed">Importe €</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step={0.01}
                className="bg-white"
                aria-label={`Comisión de ${supplier.name}`}
                placeholder={mixedValue ? "Valores distintos" : "Sin definir"}
                value={mixedValue ? "" : draft.commission_value}
                onChange={(event) =>
                  updateDraft(supplier.id, {
                    commission_type: draft.commission_type,
                    commission_value: event.target.value,
                  })
                }
                disabled={saving || mixedType}
              />
              <TooltipComponent
                color="bg-primary"
                content="Quitar comisión por defecto"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Quitar comisión por defecto de ${supplier.name}`}
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() =>
                    updateDraft(supplier.id, { commission_value: "" })
                  }
                  disabled={saving || !isDefined}
                >
                  <X size={16} />
                </Button>
              </TooltipComponent>
            </div>
          );
        })}
      </div>

      {dirty && <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white p-3 shadow-lg">
        <p role="status" className="text-sm text-gray-700">{invalid ? "Introduce valores válidos, iguales o mayores que cero." : "Tienes cambios sin guardar (incluidos los de otros segmentos)."}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={discard} disabled={saving}>Descartar</Button>
          <Button onClick={handleSave} disabled={saving || invalid}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
      </div>}
    </section>
  );
}
