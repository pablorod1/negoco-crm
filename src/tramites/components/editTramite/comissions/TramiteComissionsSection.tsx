"use client";
import { formatComission } from "@/core/utils/format";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { CheckCircle, CircleX, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { InputComponent } from "../../createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { TramiteDB } from "@/tramites/types";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useUserCompanyCommissions } from "@/core/hooks/use-user-company-commissions";
import { calculateSalesPersonCommission } from "@/core/utils/sales-commission";

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
  const [salesCommissionTouched, setSalesCommissionTouched] = useState(false);
  const { activeSuppliers } = useActiveEnergySuppliers();
  const { commissions: userCompanyCommissions } = useUserCompanyCommissions(
    tramite.user_id,
  );

  const isComercial = userData && userData.role === "2";

  useEffect(() => {
    if (salesCommissionTouched) return;

    const calculatedCommission = calculateSalesPersonCommission({
      baseCommission: formData.comision,
      supplierId: tramite.provider,
      supplierName: tramite.provider,
      commissions: userCompanyCommissions,
      suppliers: activeSuppliers,
    });

    if (calculatedCommission === null) return;

    setFormData((prev) => {
      if (prev.comision_sales_person === calculatedCommission) return prev;

      return {
        ...prev,
        comision_sales_person: calculatedCommission,
      };
    });
  }, [
    activeSuppliers,
    formData.comision,
    salesCommissionTouched,
    tramite.provider,
    userCompanyCommissions,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "comision_sales_person") setSalesCommissionTouched(true);
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
    <div className="grid grid-cols-1 gap-3">
      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-800">
              {isComercial ? "Comisión" : "Comisión comercial"}
            </h4>
            <p className="text-xs text-gray-500">Asignada al comercial</p>
          </div>
          {!isComercial && isEditable && !isSalesComissionEditMode ? (
            <Button
              size="sm"
              variant={isSalesComissionEditMode ? "outline" : "ghost"}
              onClick={() =>
                setIsSalesComissionEditMode(!isSalesComissionEditMode)
              }
              className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
            >
              <Pencil className="mr-1 size-3" />
              Editar
            </Button>
          ) : null}
        </div>

        {!isSalesComissionEditMode ? (
          <div className="text-xl font-bold leading-none text-gray-950">
            {formatComission(tramite.comision_sales_person)}
          </div>
        ) : (
          <div className="space-y-3">
            <InputComponent
              type="number"
              name="comision_sales_person"
              value={formData.comision_sales_person.toString()}
              label="Nueva comisión comercial"
              onChange={handleChange}
            />
            {!salesCommissionTouched && (
              <p className="text-xs text-primary-500">
                Calculada automáticamente si existe una regla para esta
                comercializadora.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSubmit}>
                <CheckCircle className="mr-2 size-4" />
                Guardar
              </Button>
              <Button
                size="sm"
                variant="dangerGhost"
                onClick={() => setIsSalesComissionEditMode(false)}
              >
                <CircleX className="mr-2 size-4" />
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {!isComercial && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-gray-800">
                Comisión {userData?.organization.name}
              </h4>
              <p className="text-xs text-gray-500">Comisión de organización</p>
            </div>
            {isEditable && !isComissionEditMode ? (
              <Button
                size="sm"
                variant={isComissionEditMode ? "outline" : "ghost"}
                onClick={() => setIsComissionEditMode(!isComissionEditMode)}
                className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
              >
                <Pencil className="mr-1 size-3" />
                Editar
              </Button>
            ) : null}
          </div>

          {!isComissionEditMode ? (
            <div className="text-xl font-bold leading-none text-gray-950">
              {formatComission(tramite.comision)}
            </div>
          ) : (
            <div className="space-y-3">
              <InputComponent
                type="number"
                name="comision"
                value={formData.comision.toString()}
                label="Nueva comisión de organización"
                onChange={handleChange}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleSubmit}>
                  <CheckCircle className="mr-2 size-4" />
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="dangerGhost"
                  onClick={() => setIsComissionEditMode(false)}
                >
                  <CircleX className="mr-2 size-4" />
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
