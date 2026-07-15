"use client";
import { Zap } from "lucide-react";
import { PLAIN_CONTRACT_TYPES, PLANS, POTS } from "@/tramites/constants";
import { ContractDB } from "@/tramites/types";
import { validateField } from "@/tramites/utils/validation/create-contract/field-validation";
import { validateContract } from "@/tramites/utils/validation/create-contract/form-validation";
import {
  ContractError,
  createEmptyContractError,
} from "@/core/validation/validation.types";
import { Textarea } from "@/core/components/ui/textarea";
import React from "react";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import FormWrapper from "../../createTramite/FormWrapper";
import {
  InputComponent,
  SelectComponent,
} from "../../createTramite/InputComponent";
import { Label } from "@/core/components/ui/label";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useImaginaRates } from "@/comercializadoras/hooks/useImaginaRates";
import ImaginaContractFields from "../../createTramite/forms/ImaginaContractFields";
import {
  resolveSupplierSelection,
  validateImaginaRate,
} from "@/tramites/utils/validation/create-contract/rate-validation";

interface Props {
  onSavingContract: (contract: ContractDB) => void;
  contract: ContractDB;
  onCancel: () => void;
  loading?: boolean;
  lastStep?: boolean;
}

export default function EditContractForm({
  onSavingContract,
  contract,
  onCancel,
  loading,
  lastStep,
}: Props) {
  const [errors, setErrors] = React.useState<ContractError>(
    createEmptyContractError,
  );
  const [formData, setFormData] = React.useState<ContractDB>(contract);
  const [historicalRateId] = React.useState(
    () => contract.rate_id?.trim() || undefined,
  );

  // Load active energy suppliers
  const {
    activeSuppliers,
    loading: suppliersLoading,
    error: suppliersError,
  } = useActiveEnergySuppliers();

  // Convert suppliers to dropdown format
  const supplierOptions = React.useMemo(
    () =>
      activeSuppliers.map((supplier) => ({
        label: supplier.name,
        value: supplier.id,
      })),
    [activeSuppliers],
  );

  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    const name = e.target.name;

    setErrors((prev) => ({
      ...prev,
      [name]: validateField(value).errorMessage || "",
    }));

    // Handle numeric fields
    const numericFields = [
      "consumption",
      "pot1",
      "pot2",
      "pot3",
      "pot4",
      "pot5",
      "pot6",
    ];
    let processedValue: string | number = value;

    if (numericFields.includes(name)) {
      // Convert string to number, handle empty strings as 0
      processedValue = value === "" ? 0 : parseFloat(value) || 0;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const handleSelectChange = (value: string, name: string) => {
    const changesNewCompany =
      name === "new_company" && value !== formData.new_company;

    setErrors((prev) => ({
      ...prev,
      [name]: validateField(value).errorMessage || "",
      ...(changesNewCompany ? { rate_id: "" } : {}),
    }));

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(changesNewCompany ? { rate_id: null } : {}),
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
    const rateValidation = validateImaginaRate({
      isImaginaContract,
      rateId: formData.rate_id,
      integration: imaginaRates.integration,
      rates: imaginaRates.rates,
      loading: imaginaRates.loading,
      error: imaginaRates.error,
    });

    if (
      validation.succeeded &&
      rateValidation.succeeded &&
      !supplierResolution.blocked
    ) {
      onSavingContract(formData);
    } else {
      setErrors({
        ...validation.errors,
        new_company:
          supplierResolution.errorMessage || validation.errors.new_company,
        rate_id: rateValidation.errorMessage || "",
      });
    }
  };

  const oldCompanyText = supplierOptions.find(
    (option) => option.value === formData.old_company,
  )?.label;
  const newCompanyText = supplierOptions.find(
    (option) => option.value === formData.new_company,
  )?.label;
  const supplierResolution = resolveSupplierSelection(
    formData.new_company,
    activeSuppliers,
    suppliersLoading,
    suppliersError,
  );
  const isImaginaContract = supplierResolution.isImagina;
  const imaginaRates = useImaginaRates({
    enabled: isImaginaContract,
    historicalRateId,
  });

  const handleRateChange = (rateId: string) => {
    const rateValidation = validateImaginaRate({
      isImaginaContract: true,
      rateId,
      integration: imaginaRates.integration,
      rates: imaginaRates.rates,
      loading: imaginaRates.loading,
      error: imaginaRates.error,
    });

    setFormData((prev) => ({ ...prev, rate_id: rateId }));
    setErrors((prev) => ({
      ...prev,
      rate_id: rateValidation.errorMessage || "",
    }));
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
              onChange={(value) => handleSelectChange(value, "type")}
              errors={errors.type}
              isRequired
              selectedKey={formData.type}
            />
            <SelectComponent
              name="plan"
              label="Tipo de tarifa"
              items={PLANS}
              onChange={(value) => handleSelectChange(value, "plan")}
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
              value={formData.province}
            />
            <InputComponent
              name="city"
              label="Población"
              onChange={handleFieldChange}
              errors={errors.city}
              type="text"
              isRequired
              value={formData.city}
            />
            <InputComponent
              name="postal_code"
              label="Código Postal"
              onChange={handleFieldChange}
              errors={errors.postal_code}
              type="text"
              isRequired
              value={formData.postal_code}
            />
          </div>
          <InputComponent
            name="address"
            label="Dirección"
            onChange={handleFieldChange}
            errors={errors.address}
            type="text"
            isRequired
            value={formData.address}
          />

          <div className="flex items-stretch gap-4 w-full">
            <InputComponent
              name="CUPS"
              label="CUPS"
              onChange={handleFieldChange}
              errors={errors.CUPS}
              type="text"
              isRequired
              value={formData.CUPS}
            />
            <SelectComponent
              name="old_company"
              label="Compañía Antigua"
              items={supplierOptions}
              onChange={(value) => handleSelectChange(value, "old_company")}
              isRequired
              selectedKey={formData.old_company || ""}
              textValue={oldCompanyText || formData.old_company || ""}
            />
            <SelectComponent
              name="new_company"
              label="Compañía Nueva"
              items={supplierOptions}
              onChange={(value) => handleSelectChange(value, "new_company")}
              errors={errors.new_company || supplierResolution.errorMessage}
              isRequired
              selectedKey={formData.new_company || ""}
              textValue={newCompanyText || formData.new_company || ""}
            />
            <InputComponent
              name="consumption"
              label="Consumo"
              onChange={handleFieldChange}
              type="number"
              value={
                typeof formData.consumption === "number"
                  ? formData.consumption.toString()
                  : (formData.consumption as string) || "0"
              }
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
                value={
                  formData[`pot${index + 1}` as keyof ContractDB]?.toString() ||
                  "0"
                }
                startContent={<Zap size={16} stroke="#333" />}
              />
            ))}
          </div>
          {isImaginaContract && (
            <ImaginaContractFields
              formData={formData}
              setFormData={setFormData}
              integration={imaginaRates.integration}
              rates={imaginaRates.rates}
              unavailableSelectedRate={imaginaRates.unavailableSelectedRate}
              ratesLoading={imaginaRates.loading}
              ratesError={imaginaRates.error}
              historicalRateId={historicalRateId}
              rateError={errors.rate_id}
              onRateChange={handleRateChange}
            />
          )}
          <div className="space-y-2 w-full">
            <Label>Descripción</Label>
            <Textarea
              name="description"
              onChange={handleFieldChange}
              value={formData.description}
            />
          </div>
        </div>
      </form>
      <ButtonGroupComponent
        loading={loading}
        submitDisabled={
          supplierResolution.blocked ||
          (isImaginaContract &&
            (imaginaRates.loading ||
              Boolean(imaginaRates.error) ||
              imaginaRates.integration === null))
        }
        lastStep={lastStep}
        onSubmit={handleAddContract}
        onCancel={onCancel}
      />
    </FormWrapper>
  );
}
