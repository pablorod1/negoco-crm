import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import RadioCards from "@/components/core/RadioGroupCards";
import FormWrapper from "@/components/tramites/createTramite/FormWrapper";
import { InputComponent } from "@/components/tramites/createTramite/InputComponent";
import { Label } from "@/components/ui/label";
import { FotovoltaicaClientType, FotovoltaicaDB } from "@/lib/core/types";
import { Building, Landmark, Users } from "lucide-react";
import { useState } from "react";

const options = [
  {
    value: "company",
    label: "Empresa",
    icon: <Building className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "public_org",
    label: "Organismo Público",
    icon: <Landmark className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "community",
    label: "Comunidad de Propietarios",
    icon: <Users className="h-6 w-6" strokeWidth={1.5} />,
  },
];

interface Props {
  formData: FotovoltaicaDB;
  setFormData: React.Dispatch<React.SetStateAction<FotovoltaicaDB>>;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
}

export default function SecondStepFotovoltaicaForm({
  onSubmit,
  formData,
  setFormData,
  onBack,
  onCancel,
}: Props) {
  const [errors, setErrors] = useState({
    client: "",
    location: "",
  });
  const handleSelect = (value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      client_type: value as FotovoltaicaClientType,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, name } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    // Validate required fields
    const newErrors = {
      client:
        formData.client !== "" ? "" : "El nombre del cliente es obligatorio.",
      location:
        formData.location !== ""
          ? ""
          : "El enlace de la ubicación es obligatorio.",
    };

    if (newErrors.client || newErrors.location) {
      setErrors(newErrors);
      return; // Stop submission if there are errors
    } else {
      onSubmit();
    }
  };
  return (
    <FormWrapper>
      <form>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <Label>
              Tipo de cliente
              <span className="text-red-500">*</span>
            </Label>
            <RadioCards
              options={options}
              onSelect={handleSelect}
              defaultOption={formData.client_type}
              className="max-w-none grid-cols-3"
            />
          </div>
          <InputComponent
            name="client"
            label="Nombre del cliente"
            placeholder="Nombre del cliente"
            value={formData.client}
            onChange={handleChange}
            isRequired
            type="text"
            errors={errors.client}
          />
          <InputComponent
            name="location"
            label="Enlace de la ubicación"
            placeholder="https://www.google.com/maps/place/..."
            value={formData.location}
            onChange={handleChange}
            isRequired
            type="text"
            errors={errors.location}
          />
        </div>
        <ButtonGroupComponent
          onSubmit={handleSubmit}
          onBack={onBack}
          onCancel={onCancel}
        />
      </form>
    </FormWrapper>
  );
}
