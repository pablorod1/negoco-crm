"use client";
import { ClientDB, DocumentType, SignerDB, TramiteDB } from "@/tramites/types";
import { createEmptyClientDB } from "@/tramites/utils/tramite.factories";
import { useCallback, useMemo, useRef } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX, UserPlus, Search } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { Badge } from "@/core/components/ui/badge";
import { Input } from "@/core/components/ui/input";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  cachedClient: ClientDB | null;
  cachedSigner: SignerDB | null;
  selectedClient: string | null;
  selectedClientData: ClientDB;
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
  loadingMore,
  hasMore,
  onLoadMore,
  searchValue,
  onSearchChange,
  cachedClient,
  cachedSigner,
  selectedClient,
  selectedClientData,
  setSelectedClient,
  setFormData,
  setSignerData,
}: Props) {
  const clientListRef = useRef<HTMLDivElement>(null);
  const clientsById = useMemo(
    () => new Map(clients.map((currentClient) => [currentClient.id, currentClient])),
    [clients],
  );
  const selectedClientPreview = selectedClient
    ? clientsById.get(selectedClient) ?? selectedClientData
    : null;
  const virtualRows = Math.ceil(clients.length / 2);
  const clientVirtualizer = useVirtualizer({
    count: virtualRows,
    getScrollElement: () => clientListRef.current,
    estimateSize: () => 112,
    overscan: 3,
  });

  // Fetch signer data for a client
  const fetchSigner = useCallback(
    async (clientId: string): Promise<SignerDB | null> => {
      try {
        const res = await fetch(`/api/v2/clients/${clientId}/signature`);

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
    async (clientToSelect: ClientDB) => {

      // Update client selection state
      setSelectedClient(clientToSelect.id);
      setClient(clientToSelect);

      // Update tramite with the selected client
      setTramite((prevState) => ({
        ...prevState,
        client_id: clientToSelect.id,
      }));

      // Check if we need to fetch a signer for this client type
      const needsSigner = ["Empresa", "Comunidad de Propietarios"].includes(
        clientToSelect.type,
      );

      if (needsSigner) {
        const signerData = await fetchSigner(clientToSelect.id);
        setSigner(signerData);
      } else {
        setSigner(null);
      }
    },
    [setClient, setSelectedClient, setTramite, setSigner, fetchSigner],
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
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
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
          {selectedClientPreview && (
            <div className="p-4 bg-primary-50  rounded-4xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <p>
                      <strong>
                        {selectedClientPreview.name}{" "}
                        {selectedClientPreview.last_name}
                      </strong>
                    </p>
                    <p>•</p>
                    <p>
                      {selectedClientPreview.email} •{" "}
                      {selectedClientPreview.document_number}
                    </p>
                  </div>
                </div>
                <Badge variant="successShadow">Seleccionado</Badge>
              </div>
            </div>
          )}

          {/* Client List */}
          <div className="space-y-3">
            {clients.length > 0 ? (
              <>
                <div
                  ref={clientListRef}
                  className="h-[320px] w-full overflow-y-auto py-2"
                >
                  <div
                    className="relative w-full"
                    style={{ height: `${clientVirtualizer.getTotalSize()}px` }}
                  >
                    {clientVirtualizer.getVirtualItems().map((virtualRow) => {
                      const rowClients = clients.slice(
                        virtualRow.index * 2,
                        virtualRow.index * 2 + 2,
                      );

                      return (
                        <div
                          key={virtualRow.key}
                          ref={clientVirtualizer.measureElement}
                          data-index={virtualRow.index}
                          className="absolute left-0 top-0 grid w-full grid-cols-2 gap-6 p-1 pb-5"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {rowClients.map((client) => (
                            <button
                              type="button"
                              key={client.id}
                              className={`cursor-pointer rounded-4xl border p-4 text-left shadow-xs transition-all duration-200 hover:shadow-md ${
                                selectedClient === client.id
                                  ? "border-primary-200 bg-primary-50 ring-2 ring-primary-200"
                                  : "hover:border-gray-300 hover:bg-gray-50"
                              }`}
                              onClick={() => void handleSelectClient(client)}
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
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Cargando…" : "Cargar más clientes"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  No se encontraron clientes
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  {searchValue
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
