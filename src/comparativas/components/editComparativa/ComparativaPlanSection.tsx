"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ComparativaPlan,
  ComparativaVM,
} from "@/comparativas/types/comparativa.types";
import { showCustomToast } from "@/core/components/CustomToast";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { cn } from "@/core/utils";
import {
  AlertTriangle,
  CheckCircle,
  CircleX,
  Loader2,
  Pencil,
} from "lucide-react";

interface ComparativaPlanSectionProps {
  comparativa: ComparativaVM;
  canEdit: boolean;
  onUpdate: () => void;
}

const PLAN_OPTIONS: Array<{ value: ComparativaPlan; label: string }> = [
  { value: "fijo", label: "Fijo" },
  { value: "indexado", label: "Indexado" },
];

function plansAreEqual(
  selectedPlans: ComparativaPlan[],
  currentPlans: ComparativaPlan[],
) {
  const currentPlanSet = new Set(currentPlans);

  return (
    selectedPlans.length === currentPlans.length &&
    selectedPlans.every((plan) => currentPlanSet.has(plan))
  );
}

export default function ComparativaPlanSection({
  comparativa,
  canEdit,
  onUpdate,
}: ComparativaPlanSectionProps) {
  const editorRevision = JSON.stringify([
    comparativa.id,
    comparativa.plan,
    canEdit,
  ]);

  return (
    <ComparativaPlanSectionContent
      key={editorRevision}
      comparativa={comparativa}
      canEdit={canEdit}
      onUpdate={onUpdate}
    />
  );
}

function ComparativaPlanSectionContent({
  comparativa,
  canEdit,
  onUpdate,
}: ComparativaPlanSectionProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPlans, setSelectedPlans] = useState<ComparativaPlan[]>([
    ...comparativa.plan,
  ]);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const firstPlanControlRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreEditFocusRef = useRef(false);
  const cannotSave =
    selectedPlans.length === 0 ||
    plansAreEqual(selectedPlans, comparativa.plan) ||
    isSaving;

  useEffect(() => {
    if (canEdit && isEditMode) {
      firstPlanControlRef.current?.focus();
      return;
    }

    if (!isEditMode && shouldRestoreEditFocusRef.current) {
      editButtonRef.current?.focus();
      shouldRestoreEditFocusRef.current = false;
    }
  }, [canEdit, isEditMode]);

  const closeEditor = () => {
    setSelectedPlans([...comparativa.plan]);
    shouldRestoreEditFocusRef.current = canEdit;
    setIsEditMode(false);
  };

  const startEditing = () => {
    shouldRestoreEditFocusRef.current = false;
    setSelectedPlans([...comparativa.plan]);
    setIsEditMode(true);
  };

  const togglePlan = (plan: ComparativaPlan, checked: boolean) => {
    setSelectedPlans((currentPlans) => {
      if (!checked) {
        return currentPlans.filter((currentPlan) => currentPlan !== plan);
      }

      return currentPlans.includes(plan)
        ? currentPlans
        : [...currentPlans, plan];
    });
  };

  const handleCancel = () => {
    closeEditor();
  };

  const handleSubmit = async () => {
    if (cannotSave) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/v2/comparisons/${comparativa.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selectedPlans }),
        },
      );

      if (response.status === 409) {
        closeEditor();
        showCustomToast({
          title: "La comparativa ha cambiado",
          message:
            "Hemos recargado los datos para que puedas revisar los planes actuales.",
          icon: AlertTriangle,
          iconColor: "var(--warning-color)",
        });
        onUpdate();
        return;
      }

      if (!response.ok) {
        showCustomToast({
          title: "No se pudieron guardar los planes",
          message:
            "Revisa la selección e inténtalo de nuevo. Tus cambios siguen disponibles.",
          icon: CircleX,
          iconColor: "var(--danger-color)",
        });
        return;
      }

      closeEditor();
      showCustomToast({
        title: "Planes actualizados",
        message: "Los planes de la comparativa se han guardado correctamente.",
        icon: CheckCircle,
        iconColor: "var(--success-color)",
      });
      onUpdate();
    } catch {
      showCustomToast({
        title: "No se pudieron guardar los planes",
        message:
          "No se ha podido conectar. Tus cambios siguen disponibles para reintentarlo.",
        icon: CircleX,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-label="Planes de la comparativa"
      className={isEditMode && canEdit ? "min-w-0 sm:col-span-2" : "min-w-0"}
    >
      <div className="mb-1 flex min-h-4 items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Planes</p>
        {canEdit && !isEditMode ? (
          <Button
            ref={editButtonRef}
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Editar planes"
            className="-my-0.5 h-auto gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary-50 hover:text-primary [&_svg]:size-3"
            onClick={startEditing}
          >
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        ) : null}
      </div>

      {canEdit && isEditMode ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
          <fieldset>
            <legend className="sr-only">
              Selecciona los planes de la comparativa
            </legend>
            <div className="flex flex-wrap gap-2">
              {PLAN_OPTIONS.map((option) => {
                const checkboxId = `comparison-${comparativa.id}-plan-${option.value}`;
                const isSelected = selectedPlans.includes(option.value);

                return (
                  <label
                    key={option.value}
                    htmlFor={checkboxId}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary/40 bg-primary-50 text-primary-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-primary/30",
                    )}
                  >
                    <Checkbox
                      ref={
                        option.value === PLAN_OPTIONS[0].value
                          ? firstPlanControlRef
                          : undefined
                      }
                      id={checkboxId}
                      checked={isSelected}
                      disabled={isSaving}
                      onCheckedChange={(checked) =>
                        togglePlan(option.value, checked === true)
                      }
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selectedPlans.length === 0 ? (
            <p className="text-xs text-danger" role="alert">
              Selecciona al menos un plan para poder guardar.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-gray-600 hover:text-gray-900"
              aria-label="Cancelar edición de planes"
              disabled={isSaving}
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              aria-label="Guardar planes"
              disabled={cannotSave}
              onClick={handleSubmit}
            >
              {isSaving ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle aria-hidden="true" />
              )}
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {comparativa.plan.length > 0 ? (
            comparativa.plan.map((plan) => (
              <Badge
                key={plan}
                variant="outline"
                className="border-gray-200 bg-gray-50 text-gray-700"
              >
                {PLAN_OPTIONS.find((option) => option.value === plan)?.label ??
                  plan}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </div>
      )}
    </section>
  );
}
