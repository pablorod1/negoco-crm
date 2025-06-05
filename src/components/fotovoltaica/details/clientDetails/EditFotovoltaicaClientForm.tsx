import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import { showCustomToast } from "@/components/core/CustomToast";
import RadioCards from "@/components/core/RadioGroupCards";
import { InputComponent } from "@/components/tramites/createTramite/InputComponent";
import { Label } from "@/components/ui/label";
import {
  FotovoltaicaClientType,
  FotovoltaicaType,
  FotovoltaicaVM,
  User,
} from "@/lib/core/types";
import {
  Building,
  CircleHelp,
  CircleX,
  FileSignature,
  HousePlug,
  Landmark,
  Repeat,
} from "lucide-react";
import { useState } from "react";

const typeOptions = [
  {
    value: "PPA",
    label: "PPA",
    description: "Power Purchase Agreement",
    icon: <FileSignature className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "Renting",
    label: "Renting",
    description: "Alquiler de placas solares",
    icon: <Repeat className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "Alquiler Cubierta",
    label: "Alquiler Cubierta",
    description: "Alquiler de cubierta para placas solares",
    icon: <HousePlug className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "",
    label: "No sé",
    description: "No estoy seguro del tipo de instalación",
    icon: <CircleHelp className="h-6 w-6" strokeWidth={1.5} />,
  },
];

const clientTypeOptions = [
  {
    value: "Empresa",
    label: "Empresa",
    icon: <Building className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "Organismo Publico",
    label: "Organismo Público",
    icon: <Landmark className="h-6 w-6" strokeWidth={1.5} />,
  },
];

interface Props {
  onSubmit: () => void;
  onCancel: () => void;
  fotovoltaica: FotovoltaicaVM;
  userData: User;
}

interface FormData {
  client: string;
  type: FotovoltaicaType;
  client_type: FotovoltaicaClientType;
}

export default function EditFotovoltaicaClientForm({
  onSubmit,
  onCancel,
  fotovoltaica,
  userData,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    client: fotovoltaica.client || "",
    type: fotovoltaica.type || "",
    client_type: fotovoltaica.client_type || "",
  });

  const checkChanges = (): {
    hasChanges: boolean;
    changes: Partial<FormData>;
  } => {
    const changes: Partial<FormData> = {};
    if (formData.client !== fotovoltaica.client) {
      changes.client = formData.client;
    }
    if (formData.type !== fotovoltaica.type) {
      changes.type = formData.type;
    }
    if (formData.client_type !== fotovoltaica.client_type) {
      changes.client_type = formData.client_type;
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

  const handleTypeSelect = (value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      type: value as FotovoltaicaType,
    }));
  };

  const handleClientTypeSelect = (value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      client_type: value as FotovoltaicaClientType,
    }));
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
          label="Nombre del Cliente"
          name="client"
          placeholder="Ingrese el nombre del cliente"
          onChange={handleInputChange}
          isRequired
          type="text"
          value={formData.client}
        />

        <div className="flex flex-col gap-4">
          <Label>
            Tipo de Instalación
            <span className="text-red-500">*</span>
          </Label>
          <RadioCards
            defaultOption={formData.type}
            onSelect={handleTypeSelect}
            options={typeOptions}
            className="max-w-none grid-cols-2"
          />
        </div>

        <div className="flex flex-col gap-4">
          <Label>
            Tipo de cliente
            <span className="text-red-500">*</span>
          </Label>
          <RadioCards
            options={clientTypeOptions}
            onSelect={handleClientTypeSelect}
            defaultOption={formData.client_type}
            className="max-w-none grid-cols-2"
          />
        </div>
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
