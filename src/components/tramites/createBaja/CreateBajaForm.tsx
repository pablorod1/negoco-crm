import { useUser } from "@/lib/contexts/UserContext";
import {
  ClientDB,
  ContractDB,
  createEmptyClientDB,
  createEmptyContractDB,
  createEmptyTramiteDB,
  TramiteDB,
  User,
} from "@/lib/core/types";
import React from "react";
import {
  InputComponent,
  SelectComponent,
} from "../createTramite/InputComponent";
import { showCustomToast } from "@/components/core/CustomToast";
import { CheckCircle, CircleX } from "lucide-react";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import { BAJA_LIQUIDEZ_STATUS } from "@/lib/core/const";

export default function CreateBajaForm({
  onFinish,
  onCancel,
}: {
  onFinish: () => void;
  onCancel: () => void;
}) {
  const { userData } = useUser();
  const [tramite, setTramite] = React.useState<TramiteDB>(
    createEmptyTramiteDB(userData as User)
  );
  const [client, setClient] = React.useState<ClientDB>(createEmptyClientDB());
  const [contracts, setContracts] = React.useState<ContractDB[]>([
    createEmptyContractDB(),
  ]);

  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "name") {
      setClient({ ...client, name: value });
    } else if (name === "document_number") {
      setClient({ ...client, document_number: value, document_type: "DNI" });
    } else if (name === "CUPS") {
      setContracts([{ ...contracts[0], CUPS: value, tramite_id: tramite.id }]);
    } else if (name === "comision") {
      setTramite({ ...tramite, comision: -value });
    } else if (name === "comision_sales_person") {
      setTramite({
        ...tramite,
        comision_sales_person: -value,
        client_id: client.id,
        status: "Baja",
        creation_date: new Date().toISOString(),
        tramitation_date: new Date().toISOString(),
        activation_date: new Date().toISOString(),
      });
    } else {
      setTramite({ ...tramite, [name]: value });
    }
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();

      formData.append("tramite", JSON.stringify(tramite));
      formData.append("client", JSON.stringify(client));
      formData.append("contracts", JSON.stringify(contracts));
      formData.append("userData", JSON.stringify(userData));

      const result = await fetch(`/api/tramites/add`, {
        method: "POST",
        body: formData,
      });

      const { success, error } = await result.json();

      if (!success) {
        showCustomToast({
          title: "Error al crear la baja",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });

        return;
      }

      showCustomToast({
        title: "Baja creada correctamente",
        message: "La baja se ha creado correctamente",
        icon: CheckCircle,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
      onFinish();
    } catch (error) {
      console.error("Error adding tramite:", error);
      showCustomToast({
        title: "Error al crear la baja",
        message: error + " Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };
  return (
    <div className="w-full p-2 space-y-6">
      <form>
        <div className="flex flex-col  gap-4 ">
          <SelectComponent
            isRequired
            label="Estado de Liquidez"
            name="liquidez_status"
            onChange={handleFieldChange}
            items={BAJA_LIQUIDEZ_STATUS}
            selectedKey={tramite.liquidez_status as string}
          />
          <div className="flex items-center gap-4">
            <InputComponent
              isRequired
              type="text"
              label="Nombre Cliente"
              name="name"
              onChange={handleFieldChange}
            />
            <InputComponent
              isRequired
              label="DNI"
              name="document_number"
              onChange={handleFieldChange}
              type="text"
            />
          </div>
          <InputComponent
            isRequired
            label="CUPS"
            name="CUPS"
            onChange={handleFieldChange}
            type="text"
          />
          <div className="flex items-center gap-4">
            <InputComponent
              isRequired
              label="Comisión"
              name="comision"
              onChange={handleFieldChange}
              type="number"
            />
            <InputComponent
              isRequired
              type="number"
              label="Comisión comercial"
              name="comision_sales_person"
              onChange={handleFieldChange}
            />
          </div>
        </div>
      </form>
      <ButtonGroupComponent
        onCancel={onCancel}
        onSubmit={handleSubmit}
        lastStep
      />
    </div>
  );
}
