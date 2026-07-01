"use client";

import { CLIENT_TYPES, DOCUMENT_TYPES } from "@/tramites/constants";
import { useState } from "react";
import {
  InputComponent,
  SelectComponent,
} from "../../../createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX } from "lucide-react";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { ClientDB, SignerDB } from "@/tramites/types";
import ClientUpdateConfirmationDialog from "../ClientUpdateConfirmationDialog";
import { User } from "@/core/types";

type ClientType = keyof typeof DOCUMENT_TYPES;

const TIPO_VIA_CNMC = [
  "Calle",
  "Avenida",
  "Plaza",
  "Paseo",
  "Camino",
  "Carretera",
  "Ronda",
  "Travesía",
  "Urbanización",
  "Polígono",
];

const clientRequiresSigner = (clientType: string) =>
  clientType === "Empresa" || clientType === "Comunidad de Propietarios";

const getDocumentTypeOptions = (clientType: string): string[] => {
  if (clientType in DOCUMENT_TYPES) {
    return [...DOCUMENT_TYPES[clientType as ClientType].documentTypes];
  }

  return [];
};

const hasRequiredText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasValidSigner = (signer?: SignerDB): signer is SignerDB =>
  Boolean(
    signer &&
      hasRequiredText(signer.id) &&
      hasRequiredText(signer.name) &&
      hasRequiredText(signer.last_name) &&
      hasRequiredText(signer.email) &&
      hasRequiredText(signer.phone) &&
      hasRequiredText(signer.document_number),
  );

interface Props {
  tramite_id: string;
  client: ClientDB;
  onCancel: () => void;
  onClientUpdated: () => void;
  signer?: SignerDB | undefined;
  userData: User;
}

export default function EditClientForm({
  client,
  onClientUpdated,
  onCancel,
  tramite_id,
  signer,
  userData,
}: Props) {
  const [formData, setFormData] = useState<ClientDB>(client);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const documentTypeOptions = getDocumentTypeOptions(formData.type);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prev) => {
      if (name !== "type") {
        return {
          ...prev,
          [name]: value,
        };
      }

      const nextDocumentTypeOptions = getDocumentTypeOptions(value);

      return {
        ...prev,
        type: value,
        document_type: nextDocumentTypeOptions.includes(prev.document_type)
          ? prev.document_type
          : "",
      };
    });
  };

  const checkChanges = () => {
    return JSON.stringify(client) !== JSON.stringify(formData);
  };

  const handleSubmit = async () => {
    if (!checkChanges()) {
      showCustomToast({
        title: "No se han realizado cambios",
        message: "No se han realizado cambios en el formulario",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: CircleX,
      });
      onCancel();
      return;
    }

    if (!documentTypeOptions.includes(formData.document_type)) {
      showCustomToast({
        title: "Tipo de documento no válido",
        message: "Selecciona un tipo de documento válido para este cliente",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    if (clientRequiresSigner(formData.type) && !hasValidSigner(signer)) {
      showCustomToast({
        title: "Faltan datos del firmante",
        message: "Este tipo de cliente requiere un firmante válido",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const getSignerPayload = (clientId: string) => {
    if (!clientRequiresSigner(formData.type) || !hasValidSigner(signer)) {
      return undefined;
    }

    return {
      ...signer,
      client_id: clientId,
    };
  };

  const updateExistingClientWithoutTramite = async () => {
    setLoading(true);

    if (!userData) {
      return;
    }
    try {
      const res = await fetch(`/api/v2/clients/${client.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client: formData,
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
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const updateExistingClient = async () => {
    setLoading(true);
    if (!userData) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/v2/contracts/${tramite_id}/client`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client: formData,
          signer: getSignerPayload(formData.id),
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
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const createNewClient = async () => {
    setLoading(true);
    try {
      // Create new client with updated information
      const newClientData = {
        ...formData,
        id: `CLI-${crypto.randomUUID()}`,
      };

      const signerPayload = getSignerPayload(newClientData.id);

      const res = await fetch(`/api/v2/contracts/${tramite_id}/client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client: newClientData,
          signer: signerPayload,
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al crear el nuevo cliente",
          message: error as string,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Nuevo cliente creado",
        message: "Se ha creado un nuevo cliente con la información actualizada",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CircleX,
      });
      onClientUpdated();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al crear el nuevo cliente",
        message: error as string,
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="h-full">
      <div className="flex flex-col gap-4 w-full">
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
        <SelectComponent
          name="type"
          label="Tipo de cliente"
          selectedKey={formData.type}
          isRequired
          items={[...CLIENT_TYPES]}
          onChange={(value) => handleSelectChange(value, "type")}
        />
        <div className="flex items-stretch gap-4">
          <SelectComponent
            name="document_type"
            label="Tipo de documento"
            selectedKey={formData.document_type}
            isRequired
            onChange={(value) => handleSelectChange(value, "document_type")}
            items={documentTypeOptions}
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
        <InputComponent
          name="phone"
          label="Teléfono"
          value={formData.phone}
          isRequired
          onChange={handleFieldChange}
          type="text"
        />
        <InputComponent
          name="phone_prefix"
          label="Prefijo"
          value={formData.phone_prefix || "34"}
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
          name="address"
          label="Dirección"
          value={formData.address}
          isRequired
          onChange={handleFieldChange}
          type="text"
        />
        <div className="flex items-stretch gap-4">
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
        <InputComponent
          name="IBAN"
          label="IBAN"
          value={formData.IBAN}
          isRequired
          onChange={handleFieldChange}
          type="text"
        />
        {(formData.type === "Empresa" ||
          formData.type === "Comunidad de Propietarios") && (
          <InputComponent
            name="cnae"
            label="CNAE"
            value={formData.cnae || ""}
            onChange={handleFieldChange}
            type="text"
          />
        )}
        <div className="flex items-stretch gap-4">
          <SelectComponent
            name="tipo_via_cnmc"
            label="Tipo vía fiscal"
            selectedKey={formData.tipo_via_cnmc || ""}
            onChange={(value) => handleSelectChange(value, "tipo_via_cnmc")}
            items={TIPO_VIA_CNMC}
          />
          <InputComponent
            name="calle"
            label="Calle fiscal"
            value={formData.calle || ""}
            onChange={handleFieldChange}
            type="text"
          />
          <InputComponent
            name="numero_finca"
            label="Número fiscal"
            value={formData.numero_finca || ""}
            onChange={handleFieldChange}
            type="text"
          />
        </div>
        <InputComponent
          name="aclarador_finca"
          label="Aclarador fiscal"
          value={formData.aclarador_finca || ""}
          onChange={handleFieldChange}
          type="text"
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

      <ClientUpdateConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirmUpdate={
          tramite_id ? updateExistingClient : updateExistingClientWithoutTramite
        }
        onCreateNew={createNewClient}
        clientId={client.id}
        isLoading={loading}
      />
    </div>
  );
}
