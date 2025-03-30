"use client";
import { Zap } from "lucide-react";
import {
  PLAIN_COMPANIES,
  PLAIN_CONTRACT_TYPES,
  PLANS,
  POTS,
} from "@/lib/core/const";
import { ContractDB, createEmptyContractDB } from "@/lib/core/types";
import { validateField } from "@/lib/validation/create-contract/field-validation";
import { validateContract } from "@/lib/validation/create-contract/form-validation";
import {
  ContractError,
  createEmptyContractError,
} from "@/lib/validation/validation.types";
import { Textarea } from "@heroui/input";
import React from "react";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import { InputComponent, SelectComponent } from "../InputComponent";
import { showCustomToast } from "@/components/core/CustomToast";

interface Props {
  onCreateContract: (contract: ContractDB) => void;
  tramite_id: string;
  onCancel: () => void;
}

export default function ContractForm({
  onCreateContract,
  tramite_id,
  onCancel,
}: Props) {
  const [errors, setErrors] = React.useState<ContractError>(
    createEmptyContractError
  );
  const [formData, setFormData] = React.useState<ContractDB>(
    createEmptyContractDB
  );

  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value;
    const name = e.target.name;

    setErrors((prev) => ({
      ...prev,
      [name]: validateField(value).errorMessage || "",
    }));

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddContract = () => {
    const validation = validateContract({
      type: formData.type,
      postal_code: formData.postal_code,
      province: formData.province,
      city: formData.city,
      address: formData.address,
      CUPS: formData.CUPS,
      plan: formData.plan,
      new_company: formData.new_company,
    });

    if (!validation.succeeded) {
      showCustomToast({
        title: "Error",
        message: "Por favor, rellena todos los campos obligatorios",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: Zap,
      });
      setErrors(validation.errors);
      return;
    }

    onCreateContract({
      ...formData,
      tramite_id: tramite_id,
    });
  };

  return (
    <FormWrapper>
      <form>
        <div className="flex flex-col gap-y-8 w-full">
          <div className="flex items-stretch gap-4 w-full">
            <SelectComponent
              name="type"
              label="Tipo de contrato"
              items={PLAIN_CONTRACT_TYPES}
              onChange={handleFieldChange}
              errors={errors.type}
              isRequired
              selectedKey={formData.type}
            />
            <SelectComponent
              name="plan"
              label="Tipo de tarifa"
              items={PLANS}
              onChange={handleFieldChange}
              errors={errors.plan}
              isRequired
              selectedKey={formData.plan}
            />
          </div>
          <div className="flex items-stretch gap-4 w-full">
            <InputComponent
              name="province"
              label="Provincia"
              onChange={handleFieldChange}
              errors={errors.province}
              type="text"
              isRequired
            />
            <InputComponent
              name="city"
              label="Población"
              onChange={handleFieldChange}
              errors={errors.city}
              type="text"
              isRequired
            />
            <InputComponent
              name="postal_code"
              label="Código Postal"
              onChange={handleFieldChange}
              errors={errors.postal_code}
              type="text"
              isRequired
            />
          </div>
          <InputComponent
            name="address"
            label="Dirección"
            onChange={handleFieldChange}
            errors={errors.address}
            type="text"
            isRequired
          />

          <div className="flex items-stretch gap-4 w-full">
            <InputComponent
              name="CUPS"
              label="CUPS"
              onChange={handleFieldChange}
              errors={errors.CUPS}
              type="text"
              isRequired
            />
            <SelectComponent
              name="old_company"
              label="Compañía Antigua"
              items={[...PLAIN_COMPANIES, "Otra"]}
              onChange={handleFieldChange}
              selectedKey={formData.old_company}
            />
            <SelectComponent
              name="new_company"
              label="Compañía Nueva"
              items={PLAIN_COMPANIES}
              onChange={handleFieldChange}
              errors={errors.new_company}
              isRequired
              selectedKey={formData.new_company}
            />
            <InputComponent
              name="consumption"
              label="Consumo"
              onChange={handleFieldChange}
              type="number"
            />
          </div>
          <div className="flex items-stretch gap-4 w-full">
            {POTS.map((pot, index) => (
              <InputComponent
                key={index}
                onChange={handleFieldChange}
                name={`pot${index + 1}`}
                label={pot}
                type="number"
                startContent={<Zap width={20} height={20} stroke="#333" />}
              />
            ))}
          </div>
          <Textarea
            size="lg"
            name="description"
            onChange={handleFieldChange}
            label="Descripción"
            radius="sm"
          />
        </div>
      </form>
      <ButtonGroupComponent onSubmit={handleAddContract} onCancel={onCancel} />
    </FormWrapper>
  );
}
