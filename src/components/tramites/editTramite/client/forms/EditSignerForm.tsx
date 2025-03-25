import { SignerDB } from "@/lib/core/types";

import { CARGOS } from "@/lib/core/const";
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
  signer: SignerDB;
  onCancel: () => void;
  onSignerUpdated: () => void;
}

export default function EditSignerForm({
  signer,
  onSignerUpdated,
  onCancel,
}: Props) {
  const [formData, setFormData] = useState<SignerDB>(signer);

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
    return JSON.stringify(signer) !== JSON.stringify(formData);
  };

  const handleSubmit = async () => {
    try {
      if (!checkChanges()) {
        showCustomToast({
          title: "Operación Cancelada",
          message: "No se han realizado cambios",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      const res = await fetch(`/api/tramites/update/signer`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signer: formData }),
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
      onSignerUpdated();
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
      <EditFormWrapper title="Datos del firmante">
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
            <InputComponent
              name="document_number"
              label="Número de documento"
              value={formData.document_number}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
          </div>
          {signer.cargo && (
            <SelectComponent
              name="cargo"
              label="Cargo"
              selectedKey={formData.cargo || ""}
              onChange={handleFieldChange}
              items={CARGOS}
            />
          )}
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
