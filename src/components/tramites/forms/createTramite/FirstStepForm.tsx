"use client";
import { CLIENT_TYPES } from "@/lib/const";
import { ClientDB, TramiteDB } from "@/lib/types";
import { firstFormValidation } from "@/lib/validation/create-tramite/form-validation";
import {
  createEmptyFirstForm,
  createEmptyFirstFormError,
  FirstForm,
  FirstFormError,
} from "@/lib/validation/validation.types";

import { useState } from "react";
import ButtonGroupComponent from "./ButtonGroupComponent";
import FormWrapper from "./FormWrapper";
import { SelectComponent } from "./InputComponent";

interface Props {
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onSubmitSuccess: () => void;
  client: ClientDB;
  tramite: TramiteDB;
  onCancel: () => void;
}

export default function FirstStepForm({
  setClient,
  setTramite,
  onSubmitSuccess,
  tramite,
  onCancel,
}: Props) {
  const [errors, setErrors] = useState<FirstFormError>(
    createEmptyFirstFormError
  );
  const [formData, setFormData] = useState<FirstForm>(createEmptyFirstForm());

  const comerciales = ["Juan", "Pedro", "Luis"];

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    const formValidationResult = firstFormValidation(formData);
    if (formValidationResult.succeeded) {
      setTramite({
        ...tramite,
        sales_name: formData.sales_name,
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
          <SelectComponent
            name="sales_name"
            label="Comercial"
            items={comerciales}
            errors={errors.sales_name}
            onChange={handleFieldChange}
            isRequired
            selectedKey={formData.sales_name}
          />
          <SelectComponent
            name="client_type"
            label="Tipo de Cliente"
            items={CLIENT_TYPES}
            errors={errors.client_type}
            onChange={handleFieldChange}
            isRequired
            selectedKey={formData.client_type}
          />
        </div>
      </form>
      <ButtonGroupComponent onCancel={onCancel} onSubmit={handleSubmit} />
    </FormWrapper>
  );
}
