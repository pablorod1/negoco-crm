import {
  ACTIVATION_DATE,
  COMERCIAL_STATUS_TYPES,
  RENOVATION_DATE,
  STATUS_TYPES,
} from "@/lib/core/const";
import { Divider } from "@heroui/divider";
import { ContractDB, Status, TramiteDB, User } from "@/lib/core/types";

import ButtonGroupComponent from "../ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import ContractPreview from "../ContractPreview";
import CreateContractDrawer from "../CreateContractDrawer";
import { SelectComponent } from "../InputComponent";

interface Props {
  onBack: () => void;
  tramite: TramiteDB;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onSubmit: () => void;
  onCancel: () => void;
  contracts: ContractDB[];
  setContracts: React.Dispatch<React.SetStateAction<ContractDB[]>>;
  userData: User;
}

export default function ThirdStepForm({
  onBack,
  onSubmit,
  tramite,
  setTramite,
  onCancel,
  contracts,
  setContracts,
  userData,
}: Props) {
  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTramite((prevState) => {
      if (name === "status") {
        return {
          ...prevState,
          status: value as Status,
          activation_date:
            value === "Activo" ? ACTIVATION_DATE.toISOString() : "",
          renovation_date:
            value === "Activo" ? RENOVATION_DATE.toISOString() : "",
          tramitation_date:
            value === "Procesando" ||
            value === "Activo" ||
            value === "Pendiente de Firma" ||
            value === "Verificado"
              ? new Date().toISOString()
              : "",
        };
      } else {
        return {
          ...prevState,
          [name]: value,
        };
      }
    });
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
              items={
                userData.role === "2" ? COMERCIAL_STATUS_TYPES : STATUS_TYPES
              }
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
              userData={userData}
              tramite={tramite}
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
