import {
  ClientDB,
  createEmptyClientDB,
  SignerDB,
  TramiteDB,
  User,
} from "@/lib/core/types";
import { useState } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Props {
  userData: User;
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  setSigner: React.Dispatch<React.SetStateAction<SignerDB | null>>;
  setNewClientState: React.Dispatch<React.SetStateAction<boolean>>;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  clients: ClientDB[];
  loading: boolean;
  newClient: ClientDB | null;
  newSigner: SignerDB | null;
  selectedClient: string | null;
  setSelectedClient: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function SelectClient({
  userData,
  setClient,
  setSigner,
  setNewClientState,
  setTramite,
  clients,
  loading,
  newClient,
  newSigner,
  selectedClient,
  setSelectedClient,
}: Props) {
  const [filterValue, setFilterValue] = useState<string>("");

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
    e: React.MouseEvent<HTMLButtonElement>,
    id: string
  ) => {
    e.preventDefault();
    const selectedClient = clients.find((c) => c.id === id);
    if (!selectedClient) return;

    setSelectedClient(selectedClient.id);
    setClient(selectedClient as ClientDB);
    setTramite((prevState) => ({
      ...prevState,
      client_id: selectedClient.id,
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

  const handleSelectNewClient = () => {
    if (newClient) {
      setClient(newClient);
      setSigner(newSigner);
      setTramite((prevState) => ({
        ...prevState,
        client_id: newClient.id,
      }));
      setSelectedClient(newClient.id);
      setNewClientState(true);
    }
  };

  const filteredClients = clients.filter((client) => {
    const { name, last_name, email } = client;
    const normalizedName = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const normalizedLastName = last_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const normalizedEmail = email
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const normalizedFilterValue = filterValue
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const fullName = `${normalizedName} ${normalizedLastName}`;
    const document_number = client.document_number.toLowerCase();

    return (
      normalizedName.includes(normalizedFilterValue) ||
      normalizedLastName.includes(normalizedFilterValue) ||
      normalizedEmail.includes(normalizedFilterValue) ||
      fullName.includes(normalizedFilterValue) ||
      document_number.includes(normalizedFilterValue)
    );
  });

  const handleNewClient = () => {
    setNewClientState(true);
    setClient(createEmptyClientDB());
    setSigner(null);
  };

  return (
    <>
      <div className="flex justify-between items-center w-full gap-4">
        <div className="flex flex-col w-full mt-4">
          <h2 className="text-xl font-semibold text-primary-500">
            Selecciona un cliente
          </h2>
          <span className="text-xs text-gray-500">
            {" "}
            (Si no aparece el cliente, puedes crear uno nuevo)
          </span>
        </div>
        <Input
          name="search"
          placeholder="Busca por nombre, apellidos, email..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="max-w-md w-full"
        />
      </div>
      {loading ? (
        <LoadingStateModal userData={userData} />
      ) : (
        <ScrollArea>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 justify-center w-full pt-2 pb-4">
            <Button
              size={"card"}
              variant={"outline"}
              onClick={handleNewClient}
              className="w-full justify-start gap-2 border border-gray-100 shadow-sm"
            >
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold">Nuevo Cliente</span>
                <span className="text-xs text-gray-500 text-ellipsis overflow-hidden whitespace-nowrap max-w-52 w-full">
                  Crear un nuevo cliente
                </span>
              </div>
            </Button>
            {newClient && (
              <Button
                size={"card"}
                variant={"outline"}
                onClick={handleSelectNewClient}
                className="w-full justify-start gap-2 border-dashed border-gray-100 shadow-sm"
              >
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">
                    Último cliente creado
                  </span>
                  <span className="text-xs text-gray-500 text-ellipsis overflow-hidden whitespace-nowrap max-w-52 w-full">
                    {newClient.name} {newClient.last_name}
                  </span>
                  <span className="text-xs text-gray-500 text-ellipsis overflow-hidden whitespace-nowrap max-w-52 w-full">
                    {newClient.document_type} - {newClient.document_number}
                  </span>
                </div>
              </Button>
            )}
            {filteredClients.map((client) => (
              <Button
                size={"card"}
                variant={"outline"}
                onClick={(e) => handleSelectClient(e, client.id)}
                key={client.id}
                className={`relative w-full justify-start gap-2 border border-gray-100 shadow-sm transition-all duration-200 ease-in-out ${
                  selectedClient === client.id
                    ? "shadow-md shadow-primary-700/30 border-primary-100 bg-primary-50"
                    : "hover:bg-gray-50 hover:border-gray-200"
                }`}
              >
                <div className="flex flex-col items-start w-full">
                  <div className="flex justify-between items-center gap-4 w-full">
                    <span className="text-sm font-semibold">
                      {client.name} {client.last_name}
                    </span>
                    <Badge variant="info">{client.type}</Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {client.document_type} - {client.document_number}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  );
}
