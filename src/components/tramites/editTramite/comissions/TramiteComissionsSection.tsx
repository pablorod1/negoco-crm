"use client";
import { formatComission } from "@/lib/core/format";
import { TramiteDB, User } from "@/lib/core/types";
import { Button } from "@heroui/button";
import { CheckCircle, CircleX, Pencil } from "lucide-react";
import { useState } from "react";
import { InputComponent } from "../../createTramite/InputComponent";
import { showCustomToast } from "@/components/core/CustomToast";

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
      const res = await fetch(`/api/tramites/update/comissions`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tramite_id: tramite.id,
          comision_sales_person: checkSalesComissionChanges()
            ? formData.comision_sales_person
            : undefined,
          comision: checkComissionChanges() ? formData.comision : undefined,
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
        icon: CircleX,
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
    <>
      <div className="space-y-2 group">
        <p className="text-sm font-medium text-primary-400">
          {isComercial ? "Comisión" : "Comisión Comercial"}
        </p>
        <div className="flex items-center gap-4">
          {!isSalesComissionEditMode ? (
            <p className="text-xl font-bold ">
              {formatComission(tramite.comision_sales_person)}
            </p>
          ) : (
            <InputComponent
              type="number"
              name="comision_sales_person"
              value={formData.comision_sales_person.toString()}
              label="Comisión Comercial"
              onChange={handleChange}
            />
          )}
          {!isComercial && isEditable && (
            <>
              {!isSalesComissionEditMode ? (
                <Button
                  isIconOnly
                  variant="light"
                  onPress={() =>
                    setIsSalesComissionEditMode(!isSalesComissionEditMode)
                  }
                  className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                >
                  <Pencil size={16} />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    isIconOnly
                    variant="light"
                    color="danger"
                    onPress={() => setIsSalesComissionEditMode(false)}
                  >
                    <CircleX size={16} />
                  </Button>
                  <Button
                    isIconOnly
                    variant="light"
                    color="success"
                    onPress={handleSubmit}
                  >
                    <CheckCircle size={16} />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!isComercial && (
        <div className="space-y-2 group">
          <p className="text-sm font-medium text-primary-400">
            Comisión {userData?.organization.name}
          </p>
          <div className="flex items-center gap-4">
            {!isComissionEditMode ? (
              <p className="text-xl font-bold ">
                {formatComission(tramite.comision)}
              </p>
            ) : (
              <InputComponent
                type="number"
                name="comision"
                value={formData.comision.toString()}
                label="Comisión"
                onChange={handleChange}
              />
            )}
            {!isComercial && isEditable && (
              <>
                {!isComissionEditMode ? (
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={() => setIsComissionEditMode(!isComissionEditMode)}
                    className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                  >
                    <Pencil size={16} />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      isIconOnly
                      variant="light"
                      color="danger"
                      onPress={() => setIsComissionEditMode(false)}
                    >
                      <CircleX size={16} />
                    </Button>
                    <Button
                      isIconOnly
                      variant="light"
                      color="success"
                      onPress={handleSubmit}
                    >
                      <CheckCircle size={16} />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
