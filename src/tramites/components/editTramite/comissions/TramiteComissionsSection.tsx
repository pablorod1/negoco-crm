"use client";
import { formatComission } from "@/core/utils/format";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { CheckCircle, CircleX, Pencil } from "lucide-react";
import { useState } from "react";
import { InputComponent } from "../../createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { TramiteDB } from "@/tramites/types";

interface Props {
  userData: User;
  tramite: TramiteDB;
  onUpdate: () => void;
  isEditable: boolean | null;
}

interface FormData {
  comision_sales_person: number;
  comision: number;
}

export default function TramiteComissionsSection({
  userData,
  tramite,
  onUpdate,
  isEditable,
}: Props) {
  const [isSalesComissionEditMode, setIsSalesComissionEditMode] =
    useState(false);
  const [isComissionEditMode, setIsComissionEditMode] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    comision_sales_person: tramite.comision_sales_person,
    comision: tramite.comision,
  });

  const isComercial = userData && userData.role === "2";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value),
    }));
  };

  const checkSalesComissionChanges = () => {
    return tramite.comision_sales_person !== formData.comision_sales_person;
  };

  const checkComissionChanges = () => {
    return tramite.comision !== formData.comision;
  };

  const handleSubmit = async () => {
    try {
      if (!checkSalesComissionChanges() && !checkComissionChanges()) {
        setIsComissionEditMode(false);
        setIsSalesComissionEditMode(false);
        showCustomToast({
          title: "No se han realizado cambios",
          message: "No se han realizado cambios en el formulario",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }
      const res = await fetch(`/api/v2/contracts/${tramite.id}/commissions`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comision_sales_person: checkSalesComissionChanges()
            ? formData.comision_sales_person
            : undefined,
          comision: checkComissionChanges() ? formData.comision : undefined,
          user_id: userData.id,
        }),
      });

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
        message: "Los cambios se han guardado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      setIsComissionEditMode(false);
      setIsSalesComissionEditMode(false);
      onUpdate();
      // Save changes
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al guardar los cambios",
        message: error as string,
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    }
  };
  return (
    <div className="space-y-6">
      {/* Sales Commission Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            {isComercial ? "Comisión" : "Comisión Comercial"}
          </h4>
          {!isComercial && isEditable && !isSalesComissionEditMode ? (
            <Button
              size="sm"
              variant={isSalesComissionEditMode ? "outline" : "ghost"}
              onClick={() =>
                setIsSalesComissionEditMode(!isSalesComissionEditMode)
              }
              className="h-7 px-2 text-gray-600 hover:text-gray-900"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Editar
            </Button>
          ) : null}
        </div>

        {!isSalesComissionEditMode ? (
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">
              {formatComission(tramite.comision_sales_person)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Comisión asignada al comercial
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <InputComponent
              type="number"
              name="comision_sales_person"
              value={formData.comision_sales_person.toString()}
              label="Nueva comisión comercial"
              onChange={handleChange}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Guardar
              </Button>
              <Button
                size="sm"
                variant="dangerGhost"
                onClick={() => setIsSalesComissionEditMode(false)}
              >
                <CircleX className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Organization Commission Section */}
      {!isComercial && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">
              Comisión {userData?.organization.name}
            </h4>
            {isEditable && !isComissionEditMode ? (
              <Button
                size="sm"
                variant={isComissionEditMode ? "outline" : "ghost"}
                onClick={() => setIsComissionEditMode(!isComissionEditMode)}
                className="h-7 px-2 text-gray-600 hover:text-gray-900"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
            ) : null}
          </div>

          {!isComissionEditMode ? (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">
                {formatComission(tramite.comision)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Comisión de la organización
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <InputComponent
                type="number"
                name="comision"
                value={formData.comision.toString()}
                label="Nueva comisión de organización"
                onChange={handleChange}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSubmit}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="dangerGhost"
                  onClick={() => setIsComissionEditMode(false)}
                >
                  <CircleX className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
