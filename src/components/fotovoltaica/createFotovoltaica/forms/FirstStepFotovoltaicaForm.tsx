import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import RadioCards from "@/components/core/RadioGroupCards";
import FormWrapper from "@/components/tramites/createTramite/FormWrapper";
import { FotovoltaicaDB, FotovoltaicaType } from "@/lib/core/types";
import { CircleHelp, FileSignature, HousePlug, Repeat } from "lucide-react";

const options = [
  {
    value: "PPA",
    label: "PPA",
    description: "Power Purchase Agreement",
    icon: <FileSignature className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "renting",
    label: "Renting",
    description: "Alquiler de placas solares",
    icon: <Repeat className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "cubierta",
    label: "Alquiler Cubierta",
    description: "Alquiler de cubierta para placas solares",
    icon: <HousePlug className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    value: "",
    label: "No sé",
    description: "No estoy seguro del tipo de instalación",
    icon: <CircleHelp className="h-6 w-6" strokeWidth={1.5} />,
  },
];

interface Props {
  formData: FotovoltaicaDB;
  setFormData: React.Dispatch<React.SetStateAction<FotovoltaicaDB>>;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function FirstStepFotovoltaicaForm({
  formData,
  setFormData,
  onCancel,
  onSubmit,
}: Props) {
  const handleSelect = (value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      type: value as FotovoltaicaType,
    }));
  };

  return (
    <FormWrapper>
      <form>
        <RadioCards
          defaultOption={formData.type}
          onSelect={handleSelect}
          options={options}
          className="max-w-none grid-cols-2"
        />
        <ButtonGroupComponent onCancel={onCancel} onSubmit={onSubmit} />
      </form>
    </FormWrapper>
  );
}
