"use client";
import { CircleX, Zap } from "lucide-react";
import { PLAIN_CONTRACT_TYPES, PLANS, POTS } from "@/tramites/constants";
import { ContractDB } from "@/tramites/types";
import { createEmptyContractDB } from "@/tramites/utils/tramite.factories";
import { validateField } from "@/tramites/utils/validation/create-contract/field-validation";
import { validateContract } from "@/tramites/utils/validation/create-contract/form-validation";
import {
  ContractError,
  createEmptyContractError,
} from "@/core/validation/validation.types";
import React from "react";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { InputComponent, SelectComponent } from "../InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { Textarea } from "@/core/components/ui/textarea";
import { Label } from "@/core/components/ui/label";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { Skeleton } from "@/core/components/ui/skeleton";
import { ComparativaVM } from "@/comparativas/types";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";

interface Props {
  onCreateContract: (contract: ContractDB) => void;
  tramite_id: string;
  onCancel: () => void;
  contract?: ContractDB | null;
  loading?: boolean;
  lastStep?: boolean;
  comparativa?: ComparativaVM;
}

export default function ContractForm({
  onCreateContract,
  tramite_id,
  onCancel,
  contract,
  loading,
  lastStep,
  comparativa,
}: Props) {
  const [errors, setErrors] = React.useState<ContractError>(
    createEmptyContractError
  );
  const [formData, setFormData] = React.useState<ContractDB>(
    contract ? contract : createEmptyContractDB(comparativa)
  );

  // Load active energy suppliers
  const { activeSuppliers, loading: suppliersLoading } =
    useActiveEnergySuppliers();
  const { supplier } = useEnergySupplierById(formData.new_company || "");

  const { supplier: oldSupplier } = useEnergySupplierById(
    formData.old_company || ""
  );

  // Convert suppliers to dropdown format
  const supplierOptions = React.useMemo(
    () =>
      activeSuppliers.map((supplier) => ({
        label: supplier.name,
        value: supplier.id,
      })),
    [activeSuppliers]
  );

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const name = e.target.name;

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
        icon: CircleX,
      });
      setErrors(validation.errors);
      return;
    }

    onCreateContract({
      ...formData,
      tramite_id: tramite_id,
    });
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(value).errorMessage || "",
    }));
  };

  return (
    <>
      <form>
        <ScrollArea className="w-full h-full max-h-[calc(100vh-400px)]">
          <div className="flex flex-col gap-y-4 w-full px-4">
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
                value={formData.province}
                errors={errors.province}
                type="text"
                isRequired
              />
              <InputComponent
                name="city"
                label="Población"
                onChange={handleFieldChange}
                value={formData.city}
                errors={errors.city}
                type="text"
                isRequired
              />
              <InputComponent
                name="postal_code"
                label="Código Postal"
                onChange={handleFieldChange}
                value={formData.postal_code}
                errors={errors.postal_code}
                type="text"
                isRequired
              />
            </div>
            <InputComponent
              name="address"
              label="Dirección"
              onChange={handleFieldChange}
              value={formData.address}
              errors={errors.address}
              type="text"
              isRequired
            />
            <div className="flex items-stretch gap-4 w-full">
              <InputComponent
                name="CUPS"
                label="CUPS"
                onChange={handleFieldChange}
                value={formData.CUPS}
                errors={errors.CUPS}
                type="text"
                isRequired
              />
              {suppliersLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <SelectComponent
                  name="old_company"
                  label="Compañía Antigua"
                  items={supplierOptions}
                  onChange={(value) => handleSelectChange(value, "old_company")}
                  selectedKey={formData.old_company || ""}
                  textValue={oldSupplier ? oldSupplier.name : ""}
                />
              )}
              {suppliersLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <SelectComponent
                  name="new_company"
                  label="Compañía Nueva"
                  items={supplierOptions}
                  onChange={(value) => handleSelectChange(value, "new_company")}
                  errors={errors.new_company}
                  isRequired
                  selectedKey={formData.new_company || ""}
                  textValue={supplier ? supplier.name : ""}
                />
              )}
              <InputComponent
                name="consumption"
                label="Consumo"
                value={
                  typeof formData.consumption === "number"
                    ? formData.consumption.toString()
                    : formData.consumption || ""
                }
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
                  value={
                    formData[`pot${index + 1}` as keyof ContractDB] !==
                    undefined
                      ? (
                          formData[
                            `pot${index + 1}` as keyof ContractDB
                          ] as number
                        ).toString()
                      : "0"
                  }
                  startContent={<Zap size={16} stroke="#333" />}
                />
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="description" className="text-sm font-semibold">
                Descripción
              </Label>
              <Textarea
                id="description"
                name="description"
                onChange={handleTextAreaChange}
              />
            </div>
          </div>
        </ScrollArea>
      </form>
      <ButtonGroupComponent
        loading={loading}
        onSubmit={handleAddContract}
        onCancel={onCancel}
        lastStep={lastStep}
      />
    </>
  );
}
