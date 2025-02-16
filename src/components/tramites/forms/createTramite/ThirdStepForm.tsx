import { STATUS_TYPES } from "@/lib/const";
import { Divider } from "@heroui/divider";
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
  contracts: ContractDB[];
  setContracts: React.Dispatch<React.SetStateAction<ContractDB[]>>;
}

export default function ThirdStepForm({
  onBack,
  onSubmit,
  tramite,
  setTramite,
  onCancel,
  contracts,
  setContracts,
}: Props) {
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

  const handleUpdateContract = (updatedContract: ContractDB) => {
    const updatedContracts = contracts.map((contract) =>
      contract.id === updatedContract.id ? updatedContract : contract
    );
    setContracts(updatedContracts);
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
            tramite_id={tramite.id}
            onCreateContract={handleAddContract}
          />
          {contracts.map((contract, index) => (
            <ContractPreview
              key={index}
              contract={contract}
              onSavingContract={handleUpdateContract}
            />
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
