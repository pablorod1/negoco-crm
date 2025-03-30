"use client";
import { CLIENT_TYPES } from "@/lib/core/const";
import { ClientDB, TramiteDB, User } from "@/lib/core/types";
import { firstFormValidation } from "@/lib/validation/create-tramite/form-validation";
import {
  createEmptyFirstFormError,
  FirstForm,
  FirstFormError,
} from "@/lib/validation/validation.types";

import { useEffect, useState } from "react";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import { SelectComponent } from "../InputComponent";
import { useUser } from "@/lib/contexts/UserContext";

interface Props {
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onSubmitSuccess: () => void;
  tramite: TramiteDB;
  onCancel: () => void;
  client: ClientDB;
}

export default function FirstStepForm({
  setClient,
  setTramite,
  onSubmitSuccess,
  tramite,
  onCancel,
  client,
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
  const [comerciales, setComerciales] = useState<User[]>([]);

  useEffect(() => {
    const fetchComerciales = async () => {
      const res = await fetch(`/api/users/get/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userData?.id,
          role: userData?.role,
        }),
      });
      const { success, data } = await res.json();

      if (!success) {
        return;
      }

      if (data) {
        setComerciales(data as User[]);
      }
    };
    fetchComerciales();
  }, [userData]);

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSelectComercial = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const salesPerson = comerciales.find(
      (comercial) => comercial.id === e.target.value
    );

    if (salesPerson) {
      setFormData((prevState) => ({
        ...prevState,
        sales_name: salesPerson.name,
        user_id: salesPerson.id,
      }));
    }
  };

  const handleSubmit = () => {
    const formValidationResult = firstFormValidation(formData);
    if (formValidationResult.succeeded) {
      setTramite({
        ...tramite,
        sales_name: formData.sales_name,
        user_id: formData.user_id,
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
            selectedKey={
              comerciales.find((comercial) => comercial.id === formData.user_id)
                ? formData.user_id
                : ""
            }
            isRequired
            items={comerciales}
            onChange={handleSelectComercial}
            errors={errors.sales_name}
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
