"use client";
import {
  createEmptySecondFormError,
  SecondForm,
  SecondFormError,
  SignerForm,
  createEmptySignerFormError,
  SignerFormError,
  createEmptySecondForm,
} from "@/core/validation/validation.types";
import {
  secondFormValidation,
  signerFormValidation,
} from "@/tramites/utils/validation/form-validation";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ClientDB, TramiteDB, SignerDB } from "@/tramites/types";
import { createEmptyClientDB } from "@/tramites/utils/tramite.factories";
import { ComparativaVM } from "@/comparativas/types";
import { User } from "@/core/types";
import FormWrapper from "../../FormWrapper";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import NewClientForm from "./NewClientForm";
import SelectClient from "./SelectClient";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX, User as UserIcon } from "lucide-react";

interface Props {
  client: ClientDB;
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  setSigner: React.Dispatch<React.SetStateAction<SignerDB | null>>;
  onSecondSubmitSuccess: () => void;
  onBack: () => void;
  onCancel: () => void;
  signer: SignerDB;
  userData: User;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  comparativa?: ComparativaVM;
  savedClient?: ClientDB;
}

export default function SecondStepForm({
  client,
  setClient,
  setSigner,
  onSecondSubmitSuccess,
  onBack,
  onCancel,
  signer,
  userData,
  setTramite,
  comparativa,
  savedClient,
}: Props) {
  const userId = userData.id;
  const userRole = userData.role;

  // State for client management
  const [clients, setClients] = useState<ClientDB[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMoreClients, setLoadingMoreClients] = useState(false);
  const initialClientSearch = comparativa?.abarca_estudio?.dni ?? "";
  const [clientSearch, setClientSearch] = useState(initialClientSearch);
  const [debouncedClientSearch, setDebouncedClientSearch] =
    useState(initialClientSearch);
  const [clientPage, setClientPage] = useState(1);
  const [hasMoreClients, setHasMoreClients] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(
    savedClient ? savedClient.id : null,
  );
  const hasAbarcaData = !!comparativa?.abarca_estudio;
  const [newClientState, setNewClientState] = useState<boolean>(false);
  const abarcaAutoApplied = useRef(false);

  // Form state
  const [errors, setErrors] = useState<SecondFormError>(
    createEmptySecondFormError,
  );
  const [formData, setFormData] = useState<SecondForm>(() =>
    createEmptySecondForm(comparativa),
  );
  const [signerData, setSignerData] = useState<SignerForm | null>(null);
  const [signerErrors, setSignerErrors] = useState<SignerFormError>(
    createEmptySignerFormError,
  );

  const [cachedClientData, setCachedClientData] = useState<ClientDB | null>(
    null,
  );
  const [cachedSignerData, setCachedSignerData] = useState<SignerDB | null>(
    null,
  );

  // Browser storage is read after hydration so server rendering stays safe.
  useEffect(() => {
    try {
      const storedClient = localStorage.getItem("client");
      const storedSigner = localStorage.getItem("signer");
      setCachedClientData(storedClient ? JSON.parse(storedClient) : null);
      setCachedSignerData(storedSigner ? JSON.parse(storedSigner) : null);
    } catch (error) {
      console.error("Error loading cached client data:", error);
      setCachedClientData(null);
      setCachedSignerData(null);
    }
  }, []);

  // Validate form and handle submit for new client creation
  const handleSecondSubmit = () => {
    // Different validation paths depending on client type
    let formIsValid = false;
    let signerIsValid = true;

    // Validate main form
    const formValidationResult = secondFormValidation(formData);
    setErrors(formValidationResult.errors);
    formIsValid = formValidationResult.succeeded;

    // If client type requires a signer, validate signer data too
    if (signerData) {
      const signerFormValidationResult = signerFormValidation(signerData);
      setSignerErrors(signerFormValidationResult.errors);
      signerIsValid = signerFormValidationResult.succeeded;
    }

    // If all validations pass
    if (formIsValid && signerIsValid) {
      // Update client data
      setClient({
        ...client,
        type: formData.type,
        name: formData.name,
        last_name: formData.last_name || "",
        email: formData.email,
        phone: formData.phone,
        IBAN: formData.IBAN,
        address: formData.address,
        postal_code: formData.postal_code,
        province: formData.province,
        city: formData.city,
        document_type: formData.document_type,
        document_number: formData.document_number,
      });

      // Update tramite with client ID
      setTramite((prevState) => ({
        ...prevState,
        client_id: client.id,
      }));

      // Update signer if needed
      if (signerData) {
        setSigner({
          id: `SGN-${crypto.randomUUID()}`,
          name: signerData.name,
          last_name: signerData.last_name,
          email: signerData.email,
          phone: signerData.phone,
          document_number: signerData.document_number,
          cargo: signerData.cargo || null,
          client_id: client.id,
        });
      }

      // Save client data to localStorage
      saveToLocalStorage();

      // Continue to next step
      onSecondSubmitSuccess();
    }
  };

  // Save current client and signer data to local storage
  const saveToLocalStorage = () => {
    const clientToSave = {
      ...formData,
      id: client.id,
    };

    localStorage.setItem("client", JSON.stringify(clientToSave));

    if (signerData) {
      const signerToSave = {
        ...signerData,
        id: signer.id,
        client_id: client.id,
      };
      localStorage.setItem("signer", JSON.stringify(signerToSave));
    } else {
      localStorage.removeItem("signer");
    }
  };

  // Handle submission for existing client selection
  const handleSubmitWithoutValidation = () => {
    if (!selectedClient) {
      showCustomToast({
        title: "Error",
        message: "Debes seleccionar un cliente o crear uno nuevo",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return;
    }
    onSecondSubmitSuccess();
  };

  // Handle back button
  const handleBack = () => {
    // Reset form state
    setClient(createEmptyClientDB());
    setSigner(null);
    setFormData(createEmptySecondForm(comparativa));
    setSignerData(null);
    onBack();
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setClientPage(1);
      setDebouncedClientSearch(clientSearch.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [clientSearch]);

  // Fetch only the visible page and cancel requests superseded by a new search.
  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    const isFirstPage = clientPage === 1;

    const fetchClients = async () => {
      if (isFirstPage) {
        setLoading(true);
      } else {
        setLoadingMoreClients(true);
      }

      try {
        const params = new URLSearchParams({
          id: userId,
          role: String(userRole),
          page: String(clientPage),
          limit: "50",
        });
        if (debouncedClientSearch) {
          params.set("search", debouncedClientSearch);
        }

        const res = await fetch(`/api/v2/clients?${params.toString()}`, {
          signal: controller.signal,
        });

        const { success, data, error, message, pagination } = await res.json();

        if (!success) {
          showCustomToast({
            title: "Error",
            message: error || message || "Error desconocido",
            icon: CircleX,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
          return;
        }

        const nextClients = (data ?? []) as ClientDB[];
        setClients((currentClients) => {
          if (isFirstPage) return nextClients;

          const clientsById = new Map(
            currentClients.map((currentClient) => [
              currentClient.id,
              currentClient,
            ]),
          );
          nextClients.forEach((nextClient) =>
            clientsById.set(nextClient.id, nextClient),
          );
          return Array.from(clientsById.values());
        });
        setHasMoreClients(Boolean(pagination?.hasMore));
        setClientsLoaded(true);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        showCustomToast({
          title: "Error",
          message: (error as Error).message || "Error desconocido",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        console.error("Error fetching clients:", error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMoreClients(false);
        }
      }
    };

    void fetchClients();

    return () => controller.abort();
  }, [
    clientPage,
    debouncedClientSearch,
    userId,
    userRole,
  ]);

  const loadMoreClients = useCallback(() => {
    if (!loadingMoreClients && hasMoreClients) {
      setClientPage((currentPage) => currentPage + 1);
    }
  }, [hasMoreClients, loadingMoreClients]);

  // Auto-select existing client by DNI or auto-open new client form with Abarca data
  useEffect(() => {
    if (
      !hasAbarcaData ||
      abarcaAutoApplied.current ||
      loading ||
      !clientsLoaded
    )
      return;

    const abarcaDni = comparativa?.abarca_estudio?.dni;
    if (!abarcaDni) {
      setNewClientState(true);
      abarcaAutoApplied.current = true;
      return;
    }

    const matchingClient = clients.find(
      (c) => c.document_number.toLowerCase() === abarcaDni.toLowerCase(),
    );

    if (matchingClient) {
      setSelectedClient(matchingClient.id);
      setClient(matchingClient);
      setTramite((prev) => ({ ...prev, client_id: matchingClient.id }));
    } else {
      setNewClientState(true);
    }

    abarcaAutoApplied.current = true;
  }, [
    hasAbarcaData,
    loading,
    clientsLoaded,
    clients,
    comparativa,
    setClient,
    setTramite,
  ]);

  return (
    <FormWrapper>
      <div className="space-y-6">
        {/* Step Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {newClientState ? "Crear nuevo cliente" : "Seleccionar cliente"}
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            {newClientState
              ? "Introduce la información del cliente y firmante si es necesario"
              : "Elige un cliente existente o crea uno nuevo"}
          </p>
        </div>

        {newClientState ? (
          <NewClientForm
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            signerData={signerData}
            setSignerData={setSignerData}
            signerErrors={signerErrors}
            setSignerErrors={setSignerErrors}
          />
        ) : (
          <SelectClient
            setClient={setClient}
            setSigner={setSigner}
            setNewClientState={setNewClientState}
            setTramite={setTramite}
            clients={clients}
            loading={loading}
            loadingMore={loadingMoreClients}
            hasMore={hasMoreClients}
            onLoadMore={loadMoreClients}
            searchValue={clientSearch}
            onSearchChange={setClientSearch}
            cachedClient={cachedClientData}
            cachedSigner={cachedSignerData}
            selectedClient={selectedClient}
            selectedClientData={client}
            setSelectedClient={setSelectedClient}
            setFormData={setFormData}
            setSignerData={setSignerData}
          />
        )}
      </div>

      <ButtonGroupComponent
        onCancel={onCancel}
        onBack={handleBack}
        onSubmit={
          newClientState ? handleSecondSubmit : handleSubmitWithoutValidation
        }
      />
    </FormWrapper>
  );
}
