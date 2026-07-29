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
import {
  AlertTriangle,
  CheckCircle,
  CircleX,
  Loader2,
  Pencil,
  Tags,
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
      className="rounded-xl border border-gray-200 bg-gray-50/70 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tags className="size-4 text-gray-500" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-700">Planes</h3>
        </div>
        {canEdit && !isEditMode ? (
          <Button
            ref={editButtonRef}
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Editar planes"
            onClick={startEditing}
          >
            <Pencil className="size-3" />
            Editar
          </Button>
        ) : null}
      </div>

      {canEdit && isEditMode ? (
        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="sr-only">
              Selecciona los planes de la comparativa
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLAN_OPTIONS.map((option) => {
                const checkboxId = `comparison-${comparativa.id}-plan-${option.value}`;

                return (
                  <label
                    key={option.value}
                    htmlFor={checkboxId}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-primary/40"
                  >
                    <Checkbox
                      ref={
                        option.value === PLAN_OPTIONS[0].value
                          ? firstPlanControlRef
                          : undefined
                      }
                      id={checkboxId}
                      checked={selectedPlans.includes(option.value)}
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

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              aria-label="Guardar planes"
              disabled={cannotSave}
              onClick={handleSubmit}
            >
              {isSaving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle className="size-3" />
              )}
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              aria-label="Cancelar edición de planes"
              disabled={isSaving}
              onClick={handleCancel}
            >
              <CircleX className="size-3" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {comparativa.plan.length > 0 ? (
            comparativa.plan.map((plan) => (
              <Badge key={plan} variant="info">
                {PLAN_OPTIONS.find((option) => option.value === plan)?.label ??
                  plan}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-500">Sin planes asignados</span>
          )}
        </div>
      )}
    </section>
  );
}
