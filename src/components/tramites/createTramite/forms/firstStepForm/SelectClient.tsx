import {
  ClientDB,
  createEmptyClientDB,
  createEmptySignerDB,
  SignerDB,
  User,
} from "@/lib/core/types";
import { SelectComponent } from "../../InputComponent";
import { useEffect, useState } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX } from "lucide-react";
import { FirstForm } from "@/lib/validation/validation.types";
import { CLIENT_TYPES } from "@/lib/core/const";
import { Button } from "@heroui/button";

interface Props {
  userData: User;
  formData: FirstForm;
  setFormData: React.Dispatch<React.SetStateAction<FirstForm>>;
  errors: string;
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  client: ClientDB;
  setSigner: React.Dispatch<React.SetStateAction<SignerDB | null>>;
}

export default function SelectClient({
  userData,
  formData,
  setFormData,
  errors,
  setClient,
  client,
  setSigner,
}: Props) {
  const [clients, setClients] = useState<ClientDB[]>([]);
  const [newClient, setNewClient] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));

    if (name === "client_type") {
      const needsSigner =
        value === "Empresa" || value === "Comunidad de Propietarios";
      setSigner(needsSigner ? createEmptySignerDB() : null);
    }
  };

  const fetchSigner = async (clientId: string): Promise<SignerDB | null> => {
    try {
      const res = await fetch(`/api/clients/get/signer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: clientId }),
      });

      const { success, data } = await res.json();
      if (!success) {
        showCustomToast({
          title: "Error",
          message: "Error al obtener el firmante",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return null;
      }

      return data as SignerDB;
    } catch (error) {
      showCustomToast({
        title: "Error",
        message: (error as string) || "Error desconocido",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return null;
    }
  };

  const handleSelectClient = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedClient = clients.find((c) => c.id === e.target.value);

    if (!selectedClient) return;

    setClient(selectedClient);
    setFormData((prevState) => ({
      ...prevState,
      client_type: selectedClient.type,
    }));

    const needsSigner = ["Empresa", "Comunidad de Propietarios"].includes(
      selectedClient.type
    );

    if (needsSigner) {
      const signer = await fetchSigner(selectedClient.id);
      setSigner(signer);
    } else {
      setSigner(null);
    }
  };

  useEffect(() => {
    if (!userData) return;
    const fetchComerciales = async () => {
      const res = await fetch(`/api/clients/get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userData.id,
          role: userData.role,
        }),
      });
      const { success, data, error } = await res.json();
      if (!success) {
        showCustomToast({
          title: "Error",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      if (data) {
        setClients(data as ClientDB[]);
      }

      setLoading(false);
    };
    fetchComerciales();
  }, [userData]);

  const handleNewClient = () => {
    setNewClient((prevState) => !prevState);
    setClient(createEmptyClientDB());
    setFormData((prevState) => ({
      ...prevState,
      client_type: "",
    }));

    setSigner(null);
  };

  return (
    <div className="flex flex-col items-end gap-2 w-full">
      {clients.length > 0 && !newClient ? (
        <SelectComponent
          items={!loading ? clients : []}
          name="id"
          label="Cliente"
          onChange={handleSelectClient}
          selectedKey={client.id}
          isRequired
        />
      ) : (
        <SelectComponent
          name="client_type"
          label="Tipo de Cliente"
          items={CLIENT_TYPES}
          errors={errors}
          onChange={handleFieldChange}
          isRequired
          selectedKey={formData.client_type}
        />
      )}
      <Button
        onPress={handleNewClient}
        variant="light"
        color="primary"
        size="sm"
      >
        {newClient ? "Seleccionar Cliente" : "Nuevo Cliente"}
      </Button>
    </div>
  );
}
