import { STATUS_TYPES } from "@/lib/const";
import { Divider } from "@heroui/divider";
import { useState } from "react";
import { ContractDB, TramiteDB } from "@/lib/types";

import ButtonGroupComponent from "./ButtonGroupComponent";
import FormWrapper from "./FormWrapper";
import ContractPreview from "./ContractPreview";
import CreateContractDrawer from "./CreateContractDrawer";
import { SelectComponent } from "./InputComponent";

interface Props {
  onBack: () => void;
  tramite: TramiteDB;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function ThirdStepForm({
  onBack,
  onSubmit,
  tramite,
  setTramite,
  onCancel,
}: Props) {
  const [contracts, setContracts] = useState<ContractDB[]>([]);

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTramite((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleAddContract = (newContract: ContractDB) => {
    setContracts([...contracts, newContract]);
  };

  return (
    <FormWrapper>
      <form>
        <div className="flex flex-col gap-y-4 w-full">
          <div className="flex items-stretch gap-4 w-full">
            <SelectComponent
              onChange={handleFieldChange}
              name="status"
              label="Estado"
              items={STATUS_TYPES}
              selectedKey={tramite.status}
              isRequired
            />
          </div>
        </div>
        <Divider className="my-4" />
        <h3 className="mb-4">Contratos</h3>
        <div className="flex items-start gap-4 w-full">
          <CreateContractDrawer
            tramite={tramite}
            onCreateContract={handleAddContract}
          />
          {contracts.map((contract, index) => (
            <ContractPreview key={index} contract={contract} />
          ))}
        </div>
      </form>
      <ButtonGroupComponent
        onCancel={onCancel}
        onBack={onBack}
        onSubmit={onSubmit}
      />
    </FormWrapper>
  );
}
