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

import React, { useState } from "react";
import {
  ClientDB,
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
}: Props) {
  const [errors, setErrors] = useState<SecondFormError>(
    createEmptySecondFormError
  );
  const [formData, setFormData] = useState<SecondForm>(createEmptySecondForm);
  const [signerData, setSignerData] = useState<SignerForm | null>(null);
  const [signerErrors, setSignerErrors] = useState<SignerFormError>(
    createEmptySignerFormError
  );
  const [newClient, setNewClient] = useState<boolean>(false);

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
      }));
      setTramite((prevState) => ({
        ...prevState,
        client_id: client.id,
      }));
      onSecondSubmitSuccess();
    }
  };

  const handleSubmitWithoutValidation = () => {
    onSecondSubmitSuccess();
  };

  const handleBack = () => {
    setClient(createEmptyClientDB());
    setSigner(signer ? createEmptySignerDB() : null);
    onBack();
  };

  return (
    <FormWrapper>
      {newClient ? (
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
          userData={userData}
          setClient={setClient}
          setSigner={setSigner}
          setNewClient={setNewClient}
          setTramite={setTramite}
        />
      )}
      <ButtonGroupComponent
        onCancel={onCancel}
        onBack={handleBack}
        onSubmit={
          newClient ? handleSecondSubmit : handleSubmitWithoutValidation
        }
      />
    </FormWrapper>
  );
}
