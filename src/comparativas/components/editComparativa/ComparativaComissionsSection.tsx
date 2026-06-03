"use client";
import { formatComission } from "@/core/utils/format";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { CheckCircle, CircleX, Euro, Pencil } from "lucide-react";
import { useState } from "react";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { ComparativaVM } from "@/comparativas/types/comparativa.types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";

interface Props {
  userData: User;
  comparativa: ComparativaVM;
  onUpdate: () => void;
  canEdit: boolean;
  embedded?: boolean;
}

interface FormData {
  comision_fijo?: number;
  comision_indexado?: number;
  comision_sales_person_fijo?: number;
  comision_sales_person_indexado?: number;
}

export default function ComparativaComissionsSection({
  userData,
  comparativa,
  onUpdate,
  canEdit,
  embedded = false,
}: Props) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    comision_fijo: comparativa.comision.fijo,
    comision_indexado: comparativa.comision.indexado,
    comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
    comision_sales_person_indexado: comparativa.comision_sales_person.indexado,
  });

  const isComercial = userData && userData.role === "2";
  const isSubcomercial = userData && userData.role === "2" && userData.super_id;
  const hasFijo = comparativa.plan.includes("fijo");
  const hasIndexado = comparativa.plan.includes("indexado");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  const checkChanges = () => {
    const changes: Partial<FormData> = {};

    if (hasFijo) {
      if (formData.comision_fijo !== comparativa.comision.fijo) {
        changes.comision_fijo = formData.comision_fijo;
      }
      if (
        formData.comision_sales_person_fijo !==
        comparativa.comision_sales_person.fijo
      ) {
        changes.comision_sales_person_fijo =
          formData.comision_sales_person_fijo;
      }
    }

    if (hasIndexado) {
      if (formData.comision_indexado !== comparativa.comision.indexado) {
        changes.comision_indexado = formData.comision_indexado;
      }
      if (
        formData.comision_sales_person_indexado !==
        comparativa.comision_sales_person.indexado
      ) {
        changes.comision_sales_person_indexado =
          formData.comision_sales_person_indexado;
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  };

  const handleSubmit = async () => {
    try {
      const changes = checkChanges();

      if (!changes) {
        setIsEditMode(false);
        showCustomToast({
          title: "No se han realizado cambios",
          message: "No se han realizado cambios en el formulario",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const res = await fetch(
        `/api/v2/comparisons/${comparativa.id}/commissions`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            comissions: changes,
            user_id: userData.id,
          }),
        },
      );

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al guardar los cambios",
          message: error as string,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Cambios guardados",
        message: "Las comisiones se han actualizado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });

      setIsEditMode(false);
      onUpdate();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al guardar los cambios",
        message: "Ha ocurrido un error inesperado",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    }
  };

  const getComissionText = (comission: number) => {
    if (comission === 0) {
      if (comparativa.status === "awaiting_review") {
        return "Pendiente de revisión";
      } else if (comparativa.status !== "pending") {
        return "No hay ahorro";
      }
    }

    return formatComission(comission);
  };

  const handleCancel = () => {
    setFormData({
      comision_fijo: comparativa.comision.fijo,
      comision_indexado: comparativa.comision.indexado,
      comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
      comision_sales_person_indexado:
        comparativa.comision_sales_person.indexado,
    });
    setIsEditMode(false);
  };

  const content = (
    <>
      {/* Header with edit button */}
      <CardHeader className={embedded ? "p-0 pb-3" : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Comisiones
          </CardTitle>
          {canEdit && !isEditMode ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditMode(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Editar
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={embedded ? "p-0" : undefined}>
        {!isEditMode ? (
          /* View Mode */
          <div className="grid grid-cols-2 gap-6">
            {/* Organization Commissions */}
            {!isComercial && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  {userData.organization.name}
                </p>
                <div className="space-y-1">
                  {hasFijo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fijo:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(comparativa.comision.fijo)}
                      </span>
                    </div>
                  )}
                  {hasIndexado && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Indexado:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(comparativa.comision.indexado)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sales Person Commissions */}
            {!isSubcomercial ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  {comparativa.user.name}
                </p>
                <div className="space-y-1">
                  {hasFijo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fijo:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(
                          comparativa.comision_sales_person.fijo,
                        )}
                      </span>
                    </div>
                  )}
                  {hasIndexado && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Indexado:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(
                          comparativa.comision_sales_person.indexado,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* Edit Mode */
          <div className="space-y-4">
            {/* Organization Commissions */}
            {!isComercial && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  {userData.organization.name}
                </p>
                <div className="space-y-3">
                  {hasFijo && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Comisión Fijo
                      </label>
                      <InputComponent
                        label=""
                        name="comision_fijo"
                        type="number"
                        value={formData.comision_fijo?.toString() || ""}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                  {hasIndexado && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Comisión Indexado
                      </label>
                      <InputComponent
                        label=""
                        name="comision_indexado"
                        type="number"
                        value={formData.comision_indexado?.toString() || ""}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sales Person Commissions */}
            {!isSubcomercial ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  {comparativa.user.name}
                </p>
                <div className="space-y-3">
                  {hasFijo && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Comisión Fijo
                      </label>
                      <InputComponent
                        label=""
                        name="comision_sales_person_fijo"
                        type="number"
                        value={
                          formData.comision_sales_person_fijo?.toString() || ""
                        }
                        onChange={handleChange}
                      />
                    </div>
                  )}
                  {hasIndexado && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Comisión Indexado
                      </label>
                      <InputComponent
                        label=""
                        name="comision_sales_person_indexado"
                        type="number"
                        value={
                          formData.comision_sales_person_indexado?.toString() ||
                          ""
                        }
                        onChange={handleChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSubmit} className="flex-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                Guardar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                <CircleX className="h-3 w-3 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <Card>
      {content}
    </Card>
  );
}
