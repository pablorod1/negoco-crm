"use client";
import { TramiteDB } from "@/tramites/types";
import { User } from "@/core/types";
import { firstFormValidation } from "@/tramites/utils/validation/form-validation";
import {
  createEmptyFirstFormError,
  FirstForm,
  FirstFormError,
} from "@/core/validation/validation.types";

import { useState } from "react";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import FormWrapper from "../../FormWrapper";
import { useUser } from "@/core/contexts/UserContext";
import SelectSalesPerson from "./SelectSalesPerson";

interface Props {
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onSubmitSuccess: () => void;
  tramite: TramiteDB;
  onCancel: () => void;
  onBack?: () => void;
}

export default function FirstStepForm({
  setTramite,
  onSubmitSuccess,
  tramite,
  onCancel,
  onBack,
}: Props) {
  const { userData } = useUser();
  const [errors, setErrors] = useState<FirstFormError>(
    createEmptyFirstFormError
  );
  const [formData, setFormData] = useState<FirstForm>({
    sales_name: tramite.sales_name,
    user_id: tramite.user_id,
  });

  const handleSubmit = () => {
    const formValidationResult = firstFormValidation(formData);
    if (formValidationResult.succeeded) {
      setTramite({
        ...tramite,
        sales_name: formData.sales_name,
        user_id: formData.user_id,
      });

      onSubmitSuccess();
    }
    setErrors(formValidationResult.errors);
  };

  return (
    <FormWrapper>
      <form>
        <SelectSalesPerson
          userData={userData as User}
          formData={formData}
          setFormData={setFormData}
          errors={errors}
        />
      </form>
      <ButtonGroupComponent
        onBack={onBack}
        onCancel={onCancel}
        onSubmit={handleSubmit}
      />
    </FormWrapper>
  );
}
