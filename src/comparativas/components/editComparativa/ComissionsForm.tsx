"use client";
import { ComparativaVM } from "@/comparativas/types";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { memo } from "react";

export interface ComissionFormValues {
  comision_fijo: number;
  comision_indexado: number;
  comision_sales_person_fijo: number;
  comision_sales_person_indexado: number;
}

interface ComissionsFormProps {
  comparativa: ComparativaVM;
  formDataComissions: Partial<ComissionFormValues>;
  setFormDataComissions: React.Dispatch<
    React.SetStateAction<Partial<ComissionFormValues>>
  >;
}

// Using memo to prevent unnecessary re-renders
const ComissionsForm = memo(
  ({
    comparativa,
    setFormDataComissions,
    formDataComissions,
  }: ComissionsFormProps) => {
    const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      // Convert string to number, handle empty strings as undefined
      const numericValue = value === "" ? undefined : parseFloat(value);
      setFormDataComissions((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-primary-800">
            Comisión {comparativa.user.organization?.name}
          </h3>
          <div className="flex items-center gap-2">
            {comparativa.plan.includes("fijo") && (
              <InputComponent
                type="number"
                name="comision_fijo"
                label="Precio Fijo"
                value={formDataComissions.comision_fijo?.toString() || ""}
                isRequired
                onChange={handleFieldChange}
              />
            )}
            {comparativa.plan.includes("indexado") && (
              <InputComponent
                type="number"
                name="comision_indexado"
                label="Precio Indexado"
                value={formDataComissions.comision_indexado?.toString() || ""}
                isRequired
                onChange={handleFieldChange}
              />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-primary-800">
            Comisión {comparativa.user.name}
          </h3>
          <div className="flex items-center gap-2">
            {comparativa.plan.includes("fijo") && (
              <InputComponent
                type="number"
                name="comision_sales_person_fijo"
                label="Precio Fijo"
                value={
                  formDataComissions.comision_sales_person_fijo?.toString() ||
                  ""
                }
                isRequired
                onChange={handleFieldChange}
              />
            )}
            {comparativa.plan.includes("indexado") && (
              <InputComponent
                type="number"
                name="comision_sales_person_indexado"
                label="Precio Indexado"
                value={
                  formDataComissions.comision_sales_person_indexado?.toString() ||
                  ""
                }
                isRequired
                onChange={handleFieldChange}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);

ComissionsForm.displayName = "ComissionsForm";

export default ComissionsForm;
