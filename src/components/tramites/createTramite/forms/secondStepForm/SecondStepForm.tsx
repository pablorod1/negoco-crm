import {
  createEmptySecondFormError,
  SecondForm,
  SecondFormError,
  SignerForm,
  createEmptySignerFormError,
  SignerFormError,
  createEmptySecondForm,
} from "@/lib/validation/validation.types";
import {
  secondFormValidation,
  signerFormValidation,
} from "@/lib/validation/create-tramite/form-validation";

import React, { useEffect, useState, useMemo } from "react";
import {
  ClientDB,
  ComparativaVM,
  createEmptyClientDB,
  createEmptySignerDB,
  SignerDB,
  TramiteDB,
  User,
} from "@/lib/core/types";
import FormWrapper from "../../FormWrapper";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import NewClientForm from "./NewClientForm";
import SelectClient from "./SelectClient";
import { showCustomToast } from "@/components/core/CustomToast";
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
}: Props) {
  const [clients, setClients] = useState<ClientDB[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const [errors, setErrors] = useState<SecondFormError>(
    createEmptySecondFormError
  );
  const [formData, setFormData] = useState<SecondForm>(
    createEmptySecondForm(comparativa ? comparativa : undefined)
  );
  const [signerData, setSignerData] = useState<SignerForm | null>(null);
  const [signerErrors, setSignerErrors] = useState<SignerFormError>(
    createEmptySignerFormError
  );
  const [newClientState, setNewClientState] = useState<boolean>(false);

  const newClient = useMemo(() => {
    const stored = localStorage.getItem("client");
    return stored ? JSON.parse(stored) : null;
  }, []);

  const newSigner = useMemo(() => {
    const stored = localStorage.getItem("signer");
    return stored ? JSON.parse(stored) : null;
  }, []);

  useEffect(() => {
    if (newClientState && newClient) {
      setFormData({
        type: newClient.type,
        name: newClient.name,
        last_name: newClient.last_name || "",
        email: newClient.email,
        phone: newClient.phone,
        IBAN: newClient.IBAN,
        address: newClient.address,
        postal_code: newClient.postal_code,
        province: newClient.province,
        city: newClient.city,
        document_type: newClient.document_type,
        document_number: newClient.document_number,
      });

      if (newSigner) {
        setSignerData({
          name: newSigner.name,
          last_name: newSigner.last_name,
          email: newSigner.email,
          phone: newSigner.phone,
          document_number: newSigner.document_number,
          cargo: newSigner.cargo || null,
        });
      }
    }

    return () => {
      // Cleanup function
      if (!newClientState) {
        setFormData(
          createEmptySecondForm(comparativa ? comparativa : undefined)
        );
        setSignerData(null);
      }
    };
  }, [newClientState, newClient, newSigner, comparativa]); // Only depend on newClientState

  const handleSecondSubmit = () => {
    if (signerData) {
      const signerFormValidationResult = signerFormValidation(signerData);
      const formValidationResult = secondFormValidation(formData);
      setErrors(formValidationResult.errors);
      // Update signer errors while preserving the rest of the state
      setSignerErrors(signerFormValidationResult.errors);
      if (
        signerFormValidationResult.succeeded &&
        formValidationResult.succeeded
      ) {
        setSigner((prevState) => {
          if (!prevState) return null;
          return {
            ...prevState,
            name: signerData.name,
            last_name: signerData.last_name,
            email: signerData.email,
            phone: signerData.phone,
            document_number: signerData.document_number,
            cargo: signerData.cargo || null,
            client_id: client.id,
          };
        });

        setClient((prevState) => ({
          ...prevState,
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
        }));
        setTramite((prevState) => ({
          ...prevState,
          client_id: client.id,
        }));
        onSecondSubmitSuccess();
      }
    }

    const formValidationResult = secondFormValidation(formData);

    setErrors(formValidationResult.errors);

    if (formValidationResult.succeeded) {
      setClient((prevState) => ({
        ...prevState,
        name: formData.name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        IBAN: formData.IBAN,
        address: formData.address,
        document_type: formData.document_type,
        document_number: formData.document_number,
        postal_code: formData.postal_code,
        province: formData.province,
        city: formData.city,
        type: formData.type,
      }));

      setTramite((prevState) => ({
        ...prevState,
        client_id: client.id,
      }));
      onSecondSubmitSuccess();
    }

    // save client & signer to localstorage
    localStorage.setItem(
      "client",
      JSON.stringify({
        ...formData,
        id: client.id,
        document_type: formData.document_type,
      })
    );
    if (signer) {
      localStorage.setItem(
        "signer",
        JSON.stringify({
          ...signerData,
          id: signer.id,
          client_id: client.id,
        })
      );
    } else {
      localStorage.removeItem("signer");
    }
  };

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

  const handleBack = () => {
    setClient(createEmptyClientDB());
    setSigner(signer ? createEmptySignerDB() : null);
    onBack();
  };

  useEffect(() => {
    if (!userData) return;
    const fetchClients = async () => {
      try {
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
          const sortClients = (data as ClientDB[]).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setClients(sortClients);
        }
      } catch (error) {
        showCustomToast({
          title: "Error",
          message: (error as string) || "Error desconocido",
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
          setClients={setClients}
        />
      ) : (
        <SelectClient
          setClient={setClient}
          setSigner={setSigner}
          setNewClientState={setNewClientState}
          setTramite={setTramite}
          clients={clients}
          loading={loading}
          newClient={newClient}
          newSigner={newSigner}
          setSelectedClient={setSelectedClient}
          selectedClient={selectedClient}
          comparativa={comparativa}
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
