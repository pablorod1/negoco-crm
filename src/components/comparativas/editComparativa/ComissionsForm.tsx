"use client";
import { ComparativaVM } from "@/lib/core/types";
import { NumberInput } from "@heroui/number-input";
import { memo } from "react";

interface ComissionFormValues {
  comision_fijo: number;
  comision_indexado: number;
  comision_sales_person_fijo: number;
  comision_sales_person_indexado: number;
}

interface ComissionsFormProps {
  comparativa: ComparativaVM;
  formDataComissions: ComissionFormValues;
  setFormDataComissions: React.Dispatch<
    React.SetStateAction<ComissionFormValues>
  >;
}

// Using memo to prevent unnecessary re-renders
const ComissionsForm = memo(
  ({
    comparativa,
    setFormDataComissions,
    formDataComissions,
  }: ComissionsFormProps) => {
    const handleFieldChange = (value: number, name: string) => {
      setFormDataComissions((prev) => ({
        ...prev,
        [name]: value,
      }));
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-[var(--primary-color-800)]">
            Comisión {comparativa.user.organization?.name}
          </h3>
          <div className="flex items-center gap-2">
            <NumberInput
              radius="sm"
              color="primary"
              variant="bordered"
              name="comision_fijo"
              label="Precio Fijo"
              value={formDataComissions.comision_fijo}
              isRequired
              onValueChange={(value) =>
                handleFieldChange(value, "comision_fijo")
              }
            />
            <NumberInput
              radius="sm"
              color="primary"
              variant="bordered"
              name="comision_indexado"
              label="Precio Indexado"
              value={formDataComissions.comision_indexado}
              isRequired
              onValueChange={(value) =>
                handleFieldChange(value, "comision_indexado")
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-[var(--primary-color-800)]">
            Comisión {comparativa.user.name}
          </h3>
          <div className="flex items-center gap-2">
            <NumberInput
              name="comision_sales_person_fijo"
              label="Precio Fijo"
              variant="bordered"
              radius="sm"
              color="primary"
              value={formDataComissions.comision_sales_person_fijo}
              isRequired
              onValueChange={(value) =>
                handleFieldChange(value, "comision_sales_person_fijo")
              }
            />
            <NumberInput
              variant="bordered"
              radius="sm"
              color="primary"
              name="comision_sales_person_indexado"
              label="Precio Indexado"
              value={formDataComissions.comision_sales_person_indexado}
              isRequired
              onValueChange={(value) =>
                handleFieldChange(value, "comision_sales_person_indexado")
              }
            />
          </div>
        </div>
      </div>
    );
  }
);

ComissionsForm.displayName = "ComissionsForm";

export default ComissionsForm;
