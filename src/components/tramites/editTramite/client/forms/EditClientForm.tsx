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

  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
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
              selectedKey={client.type}
              isRequired
              items={CLIENT_TYPES}
              onChange={handleFieldChange}
            />
            <SelectComponent
              name="document_type"
              label="Tipo de documento"
              selectedKey={client.document_type}
              isRequired
              onChange={handleFieldChange}
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
              value={client.document_number}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
          </div>
          <div className="flex items-stretch gap-4">
            <InputComponent
              name="phone"
              label="Teléfono"
              value={client.phone}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <InputComponent
              name="email"
              label="Email"
              value={client.email}
              isRequired
              onChange={handleFieldChange}
              type="email"
            />
          </div>
          <InputComponent
            name="address"
            label="Dirección"
            value={client.address}
            isRequired
            onChange={handleFieldChange}
            type="text"
          />
        </div>
        <ButtonGroupComponent
          onSubmit={handleSubmit}
          onCancel={onCancel}
          lastStep
        />
      </EditFormWrapper>
      {/* {(client.type === "Empresa" ||
        client.type === "Comunidad de Propietarios") && (
        <EditFormWrapper title="Datos del firmante">
          <div className="flex flex-col gap-4">
            <InputComponent
              name="signer.name"
              label="Nombre"
              value={signer.name}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="text"
            />
            <InputComponent
              name="signer.last_name"
              label="Apellidos"
              value={signer.last_name}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="text"
            />
            <InputComponent
              name="signer.phone"
              label="Teléfono"
              value={signer.phone}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="text"
            />
            <InputComponent
              name="signer.email"
              label="Email"
              value={signer.email}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="email"
            />
            <InputComponent
              name="signer.document_number"
              label="Número de documento"
              value={signer.document_number}
              editable={userData.role !== "2"}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            {client.type === "Comunidad de Propietarios" && (
              <SelectComponent
                name="signer.cargo"
                label="Cargo"
                selectedKey={signer.cargo || ""}
                onChange={handleFieldChange}
                editable={userData.role !== "2"}
                items={CARGOS}
              />
            )}
          </div>
        </EditFormWrapper>
      )} */}
    </>
  );
}
