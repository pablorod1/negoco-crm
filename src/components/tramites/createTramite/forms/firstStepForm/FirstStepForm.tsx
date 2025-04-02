"use client";
import { ClientDB, SignerDB, TramiteDB, User } from "@/lib/core/types";
import { firstFormValidation } from "@/lib/validation/create-tramite/form-validation";
import {
  createEmptyFirstFormError,
  FirstForm,
  FirstFormError,
} from "@/lib/validation/validation.types";

import { useState } from "react";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import FormWrapper from "../../FormWrapper";
import { useUser } from "@/lib/contexts/UserContext";
import SelectSalesPerson from "./SelectSalesPerson";
import SelectClient from "./SelectClient";

interface Props {
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onSubmitSuccess: () => void;
  tramite: TramiteDB;
  onCancel: () => void;
  client: ClientDB;
  setSigner: React.Dispatch<React.SetStateAction<SignerDB | null>>;
}

export default function FirstStepForm({
  setClient,
  setTramite,
  onSubmitSuccess,
  tramite,
  onCancel,
  client,
  setSigner,
}: Props) {
  const { userData } = useUser();
  const [errors, setErrors] = useState<FirstFormError>(
    createEmptyFirstFormError
  );
  const [formData, setFormData] = useState<FirstForm>({
    sales_name: tramite.sales_name,
    client_type: client.type,
    user_id: tramite.user_id,
  });

  const handleSubmit = () => {
    const formValidationResult = firstFormValidation(formData);
    if (formValidationResult.succeeded) {
      setTramite({
        ...tramite,
        sales_name: formData.sales_name,
        user_id: formData.user_id,
        client_id: client.id,
      });
      setClient((prevState) => ({
        ...prevState,
        type: formData.client_type,
      }));

      onSubmitSuccess();
    }
    setErrors(formValidationResult.errors);
  };

  return (
    <FormWrapper>
      <form>
        <div className="flex items-stretch gap-4 w-full">
          <SelectSalesPerson
            userData={userData as User}
            formData={formData}
            setFormData={setFormData}
            errors={errors.sales_name}
          />

          <SelectClient
            userData={userData as User}
            formData={formData}
            setFormData={setFormData}
            errors={errors.client_type}
            setClient={setClient}
            client={client}
            setSigner={setSigner}
          />
        </div>
      </form>
      <ButtonGroupComponent onCancel={onCancel} onSubmit={handleSubmit} />
    </FormWrapper>
  );
}
