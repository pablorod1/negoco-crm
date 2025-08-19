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

import React, { useEffect, useState, useMemo } from "react";
import { ClientDB, TramiteDB, SignerDB } from "@/tramites/types";
import { createEmptyClientDB } from "@/tramites/utils/tramite.factories";
import { ComparativaVM } from "@/comparativas/types";
import { User } from "@/core/types";
import FormWrapper from "../../FormWrapper";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import NewClientForm from "./NewClientForm";
import SelectClient from "./SelectClient";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX } from "lucide-react";

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
  // State for client management
  const [clients, setClients] = useState<ClientDB[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(
    savedClient ? savedClient.id : null
  );
  const [newClientState, setNewClientState] = useState<boolean>(false);

  // Form state
  const [errors, setErrors] = useState<SecondFormError>(
    createEmptySecondFormError
  );
  const [formData, setFormData] = useState<SecondForm>(
    createEmptySecondForm(comparativa)
  );
  const [signerData, setSignerData] = useState<SignerForm | null>(null);
  const [signerErrors, setSignerErrors] = useState<SignerFormError>(
    createEmptySignerFormError
  );

  // Get cached client/signer data from localStorage
  const cachedClientData = useMemo(() => {
    const stored = localStorage.getItem("client");
    return stored ? JSON.parse(stored) : null;
  }, []);

  const cachedSignerData = useMemo(() => {
    const stored = localStorage.getItem("signer");
    return stored ? JSON.parse(stored) : null;
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
      console.log("Validating signer data:", signerData);
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

  // Fetch clients when component mounts
  useEffect(() => {
    if (!userData || !userData.id) return;

    const fetchClients = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v2/clients`, {
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
            message: error || "Error desconocido",
            icon: CircleX,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
          return;
        }

        if (data) {
          // Sort clients alphabetically by name
          const sortedClients = (data as ClientDB[]).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setClients(sortedClients);
        }
      } catch (error) {
        showCustomToast({
          title: "Error",
          message: (error as Error).message || "Error desconocido",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        console.error("Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [userData]);

  return (
    <FormWrapper>
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
          cachedClient={cachedClientData}
          cachedSigner={cachedSignerData}
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
          setFormData={setFormData}
          setSignerData={setSignerData}
        />
      )}

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
