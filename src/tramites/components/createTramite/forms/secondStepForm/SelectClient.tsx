"use client";
import { ClientDB, DocumentType, SignerDB, TramiteDB } from "@/tramites/types";
import { createEmptyClientDB } from "@/tramites/utils/tramite.factories";
import { useState, useCallback, useMemo } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX, UserPlus, Search } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { Badge } from "@/core/components/ui/badge";
import { Input } from "@/core/components/ui/input";
import {
  createEmptySecondForm,
  SecondForm,
  SignerForm,
} from "@/core/validation/validation.types";

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
        const res = await fetch(`/api/v2/clients/${clientId}/signature`, {
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
  // Wrapper function for client selection that matches the expected signature
  const handleClientClick = useCallback(
    (client: ClientDB) => {
      const mockEvent = {
        preventDefault: () => {},
      } as React.MouseEvent<HTMLButtonElement>;
      handleSelectClient(mockEvent, client.id);
    },
    [handleSelectClient]
  );

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
    <div className="space-y-6">
      {loading ? (
        <LoadingStateModal
          title="Cargando clientes..."
          description="Espere unos segundos mientras cargamos sus clientes."
        />
      ) : (
        <>
          {/* Header with Create Button */}
          <div className="flex items-center gap-4 w-full">
            {/* Search */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, email o documento..."
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
              />
            </div>
            <Button
              onClick={handleNewClient}
              className="flex items-center gap-2"
              variant="outline"
            >
              <UserPlus className="h-4 w-4" />
              Crear nuevo cliente
            </Button>
          </div>

          {/* Selected Client Preview */}
          {selectedClient && (
            <div className="p-4 bg-primary-50  rounded-4xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {(() => {
                    const client = clients.find((c) => c.id === selectedClient);
                    return client ? (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <p>
                          <strong>
                            {client.name} {client.last_name}
                          </strong>
                        </p>
                        <p>•</p>
                        <p>
                          {client.email} • {client.document_number}
                        </p>
                      </div>
                    ) : null;
                  })()}
                </div>
                <Badge variant="successShadow">Seleccionado</Badge>
              </div>
            </div>
          )}

          {/* Client List */}
          <div className="space-y-3">
            {filteredClients.length > 0 ? (
              <ScrollArea className="h-full w-full max-h-[320px] overflow-y-auto py-2">
                <div className="grid grid-cols-2 gap-6 p-1">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className={`p-4 border rounded-4xl shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedClient === client.id
                          ? "ring-2 ring-primary-200 bg-primary-50 border-primary-200"
                          : "hover:bg-gray-50 hover:border-gray-300"
                      }`}
                      onClick={() => handleClientClick(client)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {client.name} {client.last_name}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {client.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{client.email}</span>
                            <span>•</span>
                            <span>{client.document_number}</span>
                          </div>
                          {client.phone && (
                            <p className="text-sm text-gray-500">
                              Tel: {client.phone}
                            </p>
                          )}
                        </div>
                        {selectedClient === client.id && (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  No se encontraron clientes
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  {filterValue
                    ? "Intenta con un término diferente"
                    : "No hay clientes disponibles"}
                </p>
                <Button
                  onClick={handleNewClient}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <UserPlus className="h-4 w-4" />
                  Crear primer cliente
                </Button>
              </div>
            )}
          </div>

          {/* Cached Data Notice */}
          {(cachedClient || cachedSigner) && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-4xl">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full mt-0.5 flex-shrink-0">
                  <svg
                    className="w-3 h-3 text-white ml-0.5 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex items-center justify-between text-sm w-full">
                  <div>
                    <p className="font-medium text-blue-900">
                      Datos guardados detectados
                    </p>
                    <p className="text-blue-700">
                      Se han detectado datos de cliente previamente guardados.
                      Se restaurarán automáticamente.
                    </p>
                  </div>
                  {cachedClient && (
                    <Button
                      variant={"outline"}
                      onClick={handleSelectLastClient}
                    >
                      Usar último cliente creado: {cachedClient.name}{" "}
                      {cachedClient.last_name}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
