"use client";
import { useUser } from "@/core/contexts/UserContext";
import { User } from "@/core/types";
import React, { useState, ChangeEvent, useCallback } from "react";
import {
  InputComponent,
  SelectComponent,
} from "../createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { CheckCircle, CircleX } from "lucide-react";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { BAJA_LIQUIDEZ_STATUS } from "@/tramites/constants";
import { ClientDB, ContractDB, TramiteDB } from "@/tramites/types";
import {
  createEmptyClientDB,
  createEmptyContractDB,
  createEmptyTramiteDB,
} from "@/tramites/utils/tramite.factories";

interface FormData {
  tramite: TramiteDB;
  client: ClientDB;
  contracts: ContractDB[];
}

export default function CreateBajaForm({
  onFinish,
  onCancel,
}: {
  onFinish: () => void;
  onCancel: () => void;
}) {
  const { userData } = useUser();

  const [formData, setFormData] = useState<FormData>({
    tramite: createEmptyTramiteDB(userData as User),
    client: createEmptyClientDB(),
    contracts: [createEmptyContractDB()],
  });

  const { tramite, client, contracts } = formData;

  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleFieldChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;

      // Enhanced field change logic with cleaner structure
      switch (name) {
        case "name":
        case "document_number": {
          const clientUpdates = { ...client };

          if (name === "name") {
            clientUpdates.name = value;
          } else {
            clientUpdates.document_number = value;
            clientUpdates.document_type = "DNI";
          }

          updateFormData({ client: clientUpdates });
          break;
        }
        case "CUPS":
          updateFormData({
            contracts: [
              { ...contracts[0], CUPS: value, tramite_id: tramite.id },
            ],
          });
          break;
        case "comision":
        case "comision_sales_person": {
          // Store comission values as positive for better UX during editing
          const tramiteUpdates = { ...tramite };
          tramiteUpdates[name] = Number(value) || 0;

          // Only add these properties when changing comision_sales_person
          if (name === "comision_sales_person") {
            tramiteUpdates.client_id = client.id;
            tramiteUpdates.status = "Baja";
            tramiteUpdates.creation_date = new Date().toISOString();
            tramiteUpdates.tramitation_date = new Date().toISOString();
            tramiteUpdates.activation_date = new Date().toISOString();
          }

          updateFormData({ tramite: tramiteUpdates });
          break;
        }
        default:
          updateFormData({
            tramite: { ...tramite, [name]: value },
          });
      }
    },
    [client, contracts, tramite, updateFormData]
  );

  const handleSelectChange = useCallback(
    (value: string, name: string) => {
      updateFormData({
        tramite: { ...tramite, [name]: value },
      });
    },
    [tramite, updateFormData]
  );

  const validateForm = useCallback((): boolean => {
    // Basic validation
    if (!client.name || !client.document_number) {
      showCustomToast({
        title: "Datos incompletos",
        message: "Debes completar la información del cliente",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return false;
    }

    if (!contracts[0].CUPS) {
      showCustomToast({
        title: "Datos incompletos",
        message: "El CUPS es obligatorio",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return false;
    }

    if (!tramite.liquidez_status) {
      showCustomToast({
        title: "Datos incompletos",
        message: "Debes seleccionar un estado de liquidez",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return false;
    }

    return true;
  }, [client, contracts, tramite]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    try {
      const formDataToSend = new FormData();

      // Convert comissions to negative values only when submitting
      const tramiteToSubmit = {
        ...tramite,
        comision: tramite.comision ? -Math.abs(tramite.comision) : 0,
        comision_sales_person: tramite.comision_sales_person
          ? -Math.abs(tramite.comision_sales_person)
          : 0,
      };

      formDataToSend.append("tramite", JSON.stringify(tramiteToSubmit));
      formDataToSend.append("client", JSON.stringify(client));
      formDataToSend.append("contracts", JSON.stringify(contracts));
      formDataToSend.append("userData", JSON.stringify(userData));

      const result = await fetch(`/api/v2/contracts`, {
        method: "POST",
        body: formDataToSend,
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
        message: String(error) + " Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  }, [client, contracts, onFinish, tramite, userData, validateForm]);

  return (
    <div className="w-full p-2 space-y-6">
      <form>
        <div className="flex flex-col gap-4">
          <SelectComponent
            isRequired
            label="Estado de Liquidez"
            name="liquidez_status"
            onChange={(value) => handleSelectChange(value, "liquidez_status")}
            items={BAJA_LIQUIDEZ_STATUS}
            selectedKey={tramite.liquidez_status || ""}
          />
          <div className="flex items-center gap-4">
            <InputComponent
              value={client.name}
              isRequired
              type="text"
              label="Nombre Cliente"
              name="name"
              onChange={handleFieldChange}
            />
            <InputComponent
              value={client.document_number}
              isRequired
              label="DNI"
              name="document_number"
              onChange={handleFieldChange}
              type="text"
            />
          </div>
          <InputComponent
            value={contracts[0].CUPS}
            isRequired
            label="CUPS"
            name="CUPS"
            onChange={handleFieldChange}
            type="text"
          />
          <div className="flex items-center gap-4">
            <InputComponent
              value={tramite.comision || ""}
              isRequired
              label="Comisión"
              name="comision"
              onChange={handleFieldChange}
              type="number"
            />
            <InputComponent
              value={tramite.comision_sales_person || ""}
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
