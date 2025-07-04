import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { User } from "@/core/types";
import { CircleHelp, CircleX } from "lucide-react";
import { useState } from "react";
import { FotovoltaicaVM } from "@/fotovoltaica/types";

interface Props {
  onSubmit: () => void;
  onCancel: () => void;
  fotovoltaica: FotovoltaicaVM;
  userData: User;
}

interface FormData {
  comision: number;
  comision_sales_person: number;
}

export default function EditFotovoltaicaComisionsForm({
  onSubmit,
  onCancel,
  fotovoltaica,
  userData,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    comision: fotovoltaica.comision || 0,
    comision_sales_person: fotovoltaica.comision_sales_person || 0,
  });

  const checkChanges = (): {
    hasChanges: boolean;
    changes: Partial<FormData>;
  } => {
    const changes: Partial<FormData> = {};
    if (formData.comision !== fotovoltaica.comision) {
      changes.comision = formData.comision;
    }
    if (formData.comision_sales_person !== fotovoltaica.comision_sales_person) {
      changes.comision_sales_person = formData.comision_sales_person;
    }
    return {
      hasChanges: Object.keys(changes).length > 0,
      changes,
    };
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const { hasChanges, changes } = checkChanges();

      if (!hasChanges) {
        showCustomToast({
          title: "No hay cambios",
          message: "No se han realizado cambios en los datos del cliente.",
          icon: CircleX,
          iconColor: "var(--color-warning-500)",
          iconSize: 24,
        });
        onSubmit();
        return;
      }
      const response = await fetch(
        `/api/fotovoltaica/update/${fotovoltaica.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ changes, user_id: userData.id }),
        }
      );

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al actualizar",
          message:
            error || "Error desconocido al actualizar los datos del cliente.",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Cliente actualizado",
        message: "Los datos del cliente se han actualizado correctamente.",
        icon: CircleHelp,
        iconColor: "var(--color-success-500)",
        iconSize: 24,
      });
      onSubmit();
    } catch (error) {
      console.error("Error al actualizar los datos del cliente:", error);
      showCustomToast({
        title: "Error al actualizar",
        message:
          (error as Error).message ||
          "Error desconocido al actualizar los datos del cliente.",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  return (
    <div className="h-full">
      <div className="flex flex-col gap-12 w-full">
        <InputComponent
          label="Comisión"
          name="comision"
          placeholder="Ingrese una comisión"
          onChange={handleInputChange}
          isRequired
          type="number"
          value={formData.comision}
        />

        <InputComponent
          label="Comisión Comercial"
          name="comision_sales_person"
          placeholder="Ingrese la comisión del comercial"
          onChange={handleInputChange}
          isRequired
          type="number"
          value={formData.comision_sales_person}
        />
      </div>

      <div className="absolute bottom-4 left-0 w-full px-4">
        <ButtonGroupComponent
          onSubmit={handleSubmit}
          onCancel={onCancel}
          lastStep
          loading={loading}
        />
      </div>
    </div>
  );
}
