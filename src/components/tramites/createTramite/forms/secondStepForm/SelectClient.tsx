"use client";
import {
  ClientDB,
  createEmptyClientDB,
  DocumentType,
  SignerDB,
  TramiteDB,
} from "@/lib/core/types";
import { useState, useCallback, useMemo } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX, UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  createEmptySecondForm,
  SecondForm,
  SignerForm,
} from "@/lib/validation/validation.types";

interface Props {
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  setSigner: React.Dispatch<React.SetStateAction<SignerDB | null>>;
  setNewClientState: React.Dispatch<React.SetStateAction<boolean>>;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  clients: ClientDB[];
  loading: boolean;
  cachedClient: ClientDB | null;
  cachedSigner: SignerDB | null;
  selectedClient: string | null;
  setSelectedClient: React.Dispatch<React.SetStateAction<string | null>>;
  setFormData: React.Dispatch<React.SetStateAction<SecondForm>>;
  setSignerData: React.Dispatch<React.SetStateAction<SignerForm | null>>;
}

export default function SelectClient({
  setClient,
  setSigner,
  setNewClientState,
  setTramite,
  clients,
  loading,
  cachedClient,
  cachedSigner,
  selectedClient,
  setSelectedClient,
  setFormData,
  setSignerData,
}: Props) {
  const [filterValue, setFilterValue] = useState<string>("");

  // Normalized filtered clients for efficient search
  const filteredClients = useMemo(() => {
    if (!filterValue.trim()) return clients;

    const normalizedFilterValue = filterValue
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    return clients.filter((client) => {
      // Create a normalized searchable string from client data
      const searchableFields = [
        client.name,
        client.last_name || "",
        client.email,
        client.document_number,
        `${client.name} ${client.last_name || ""}`,
      ];

      // Normalize all fields for consistent comparison
      const normalizedFields = searchableFields.map((field) =>
        field
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      );

      // Return true if any field matches the filter
      return normalizedFields.some((field) =>
        field.includes(normalizedFilterValue)
      );
    });
  }, [clients, filterValue]);

  // Fetch signer data for a client
  const fetchSigner = useCallback(
    async (clientId: string): Promise<SignerDB | null> => {
      try {
        const res = await fetch(`/api/clients/get/${clientId}/signer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: clientId }),
        });

        const { success, data, error } = await res.json();

        if (!success) {
          showCustomToast({
            title: "Error",
            message: error || "Error al obtener el firmante",
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
          message: (error as Error).message || "Error desconocido",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return null;
      }
    },
    []
  );

  // Handle client selection
  const handleSelectClient = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
      e.preventDefault();
      const selectedClient = clients.find((c) => c.id === id);
      if (!selectedClient) return;

      // Update client selection state
      setSelectedClient(selectedClient.id);
      setClient(selectedClient);

      // Update tramite with the selected client
      setTramite((prevState) => ({
        ...prevState,
        client_id: selectedClient.id,
      }));

      // Check if we need to fetch a signer for this client type
      const needsSigner = ["Empresa", "Comunidad de Propietarios"].includes(
        selectedClient.type
      );

      if (needsSigner) {
        const signerData = await fetchSigner(selectedClient.id);
        console.log("Signer data:", signerData);
        setSigner(signerData);
      } else {
        setSigner(null);
      }
    },
    [clients, setClient, setSelectedClient, setTramite, setSigner, fetchSigner]
  );

  // Handle selecting the last created client
  const handleSelectLastClient = useCallback(() => {
    if (cachedClient) {
      setFormData((prevState) => ({
        ...prevState,
        document_type: cachedClient.document_type as DocumentType,
        document_number: cachedClient.document_number,
        name: cachedClient.name,
        last_name: cachedClient.last_name,
        email: cachedClient.email,
        phone: cachedClient.phone,
        IBAN: cachedClient.IBAN,
        address: cachedClient.address,
        postal_code: cachedClient.postal_code,
        province: cachedClient.province,
        city: cachedClient.city,
        type: cachedClient.type,
      }));
      if (cachedSigner) {
        setSignerData((prev) => ({
          ...prev,
          name: cachedSigner.name,
          last_name: cachedSigner.last_name,
          email: cachedSigner.email,
          phone: cachedSigner.phone,
          document_number: cachedSigner.document_number,
          cargo: cachedSigner.cargo || "",
          client_id: cachedClient.id,
        }));
      }
      setClient(cachedClient);
      setSigner(cachedSigner);
      setTramite((prevState) => ({
        ...prevState,
        client_id: cachedClient.id,
      }));
      setSelectedClient(cachedClient.id);
      setNewClientState(true);
    }
  }, [
    cachedClient,
    cachedSigner,
    setClient,
    setSigner,
    setTramite,
    setSelectedClient,
    setNewClientState,
    setFormData,
    setSignerData,
  ]);

  // Handle creating a new client
  const handleNewClient = useCallback(() => {
    setNewClientState(true);
    setSelectedClient(null);
    setClient(createEmptyClientDB());
    setSigner(null);
    setFormData(createEmptySecondForm());
    setSignerData(null);
  }, [
    setNewClientState,
    setSelectedClient,
    setClient,
    setSigner,
    setFormData,
    setSignerData,
  ]);

  // If loading, show loading state
  if (loading) {
    return (
      <LoadingStateModal
        title="Cargando clientes..."
        description="Espere unos segundos mientras cargamos sus clientes."
      />
    );
  }

  return (
    <>
      <div className="flex justify-between items-center w-full gap-4">
        <div className="flex flex-col w-full mt-4">
          <h2 className="text-xl font-semibold text-primary-500">
            Selecciona un cliente
          </h2>
          <span className="text-xs text-gray-500">
            (Si no aparece el cliente, puedes crear uno nuevo)
          </span>
        </div>

        <div className="relative max-w-md w-full">
          <Input
            name="search"
            placeholder="Busca por nombre, apellidos, email..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="pr-10"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>

      <ScrollArea className="h-full w-full max-h-[200px] px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-center w-full pt-2 pb-4">
          {/* New Client Button */}
          <Button
            size={"card"}
            variant={"outline"}
            onClick={handleNewClient}
            className="w-full justify-start gap-2 border border-primary-700 bg-primary-500 shadow-md hover:bg-primary-600 transition-colors duration-200"
          >
            <div className="flex items-center gap-4 w-full">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-50 shadow-md">
                <UserPlus className="text-primary-700" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base font-medium text-white">
                  Nuevo Cliente
                </span>
                <span className="text-sm text-gray-50 text-ellipsis overflow-hidden whitespace-nowrap max-w-52 w-full">
                  Crear un nuevo cliente
                </span>
              </div>
            </div>
          </Button>

          {/* Last Created Client Button */}
          {cachedClient && (
            <Button
              size={"card"}
              variant={"outline"}
              onClick={handleSelectLastClient}
              className="w-full !items-start justify-start gap-2 border-dashed border-gray-100 shadow-sm hover:border-primary-100 hover:bg-gray-50 transition-all duration-200"
            >
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-semibold">
                  Último cliente creado
                </span>
                <span className="text-xs text-gray-500 text-ellipsis overflow-hidden whitespace-nowrap max-w-52 w-full">
                  {cachedClient.name} {cachedClient.last_name}
                </span>
                <span className="text-xs text-gray-500 text-ellipsis overflow-hidden whitespace-nowrap max-w-52 w-full">
                  {cachedClient.document_type} - {cachedClient.document_number}
                </span>
              </div>
            </Button>
          )}

          {/* Client List */}
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <Button
                size={"card"}
                variant={"outline"}
                onClick={(e) => handleSelectClient(e, client.id)}
                key={client.id}
                className={`relative w-full justify-start gap-2 border shadow-sm transition-all duration-200 ease-in-out ${
                  selectedClient === client.id
                    ? "shadow-md shadow-primary-700/30 border-primary-100 bg-primary-50"
                    : "border-gray-100 hover:bg-gray-50 hover:border-gray-200"
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
            ))
          ) : (
            <div className="flex items-center justify-center w-full h-full p-4 text-sm text-gray-500">
              No se encontraron clientes que coincidan con la búsqueda.
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
