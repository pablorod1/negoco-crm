import { ClientDB } from "@/lib/core/types";

import { CLIENT_TYPES, DOCUMENT_TYPES } from "@/lib/core/const";
import { EditFormWrapper } from "../../EditFormWrapper";
import { useState } from "react";
import {
  InputComponent,
  SelectComponent,
} from "../../../createTramite/InputComponent";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX } from "lucide-react";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";

interface Props {
  client: ClientDB;
  onCancel: () => void;
  onClientUpdated: () => void;
}

export default function EditClientForm({
  client,
  onClientUpdated,
  onCancel,
}: Props) {
  const [formData, setFormData] = useState<ClientDB>(client);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const checkChanges = () => {
    return JSON.stringify(client) !== JSON.stringify(formData);
  };

  const handleSubmit = async () => {
    try {
      if (!checkChanges()) {
        showCustomToast({
          title: "No se han realizado cambios",
          message: "No se han realizado cambios en el formulario",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const res = await fetch(`/api/tramites/update/client`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client: formData }),
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
      onClientUpdated();
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
      <EditFormWrapper title="Datos del cliente">
        <div className="flex flex-col gap-4">
          <div className="flex items-stretch gap-4">
            <InputComponent
              name="name"
              label="Nombre"
              value={formData.name}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <InputComponent
              name="last_name"
              label="Apellidos"
              value={formData.last_name}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
          </div>
          <div className="flex items-stretch gap-4">
            <SelectComponent
              name="type"
              label="Tipo de cliente"
              selectedKey={formData.type}
              isRequired
              items={CLIENT_TYPES}
              onChange={(value) => handleSelectChange(value, "type")}
            />
            <SelectComponent
              name="document_type"
              label="Tipo de documento"
              selectedKey={formData.document_type}
              isRequired
              onChange={(value) => handleSelectChange(value, "document_type")}
              items={
                client.type
                  ? DOCUMENT_TYPES[client.type as keyof typeof DOCUMENT_TYPES]
                      .documentTypes
                  : []
              }
            />
            <InputComponent
              name="document_number"
              label="Número de documento"
              value={formData.document_number}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
          </div>
          <div className="flex items-stretch gap-4">
            <InputComponent
              name="phone"
              label="Teléfono"
              value={formData.phone}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <InputComponent
              name="email"
              label="Email"
              value={formData.email}
              isRequired
              onChange={handleFieldChange}
              type="email"
            />
          </div>
          <div className="flex items-stretch gap-4">
            <InputComponent
              name="address"
              label="Dirección"
              value={formData.address}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <InputComponent
              name="postal_code"
              label="Código Postal"
              value={formData.postal_code}
              onChange={handleFieldChange}
              type="text"
            />
            <InputComponent
              name="province"
              label="Provincia"
              value={formData.province}
              onChange={handleFieldChange}
              type="text"
            />
            <InputComponent
              name="city"
              label="Ciudad"
              value={formData.city}
              onChange={handleFieldChange}
              type="text"
            />
          </div>
        </div>
        <ButtonGroupComponent
          onSubmit={handleSubmit}
          onCancel={onCancel}
          lastStep
        />
      </EditFormWrapper>
    </>
  );
}
