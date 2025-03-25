import {
  NOW_DATE,
  COMERCIAL_STATUS_TYPES,
  RENOVATION_DATE,
  PLAIN_STATUS_TYPES,
} from "@/lib/core/const";
import { Divider } from "@heroui/divider";
import { ContractDB, Status, TramiteDB, User } from "@/lib/core/types";
import { NumberInput } from "@heroui/number-input";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import ContractPreview from "../ContractPreview";
import CreateContractDrawer from "../CreateContractDrawer";
import { SelectComponent } from "../InputComponent";
import { useState } from "react";
import CheckComisionModal from "../CheckComisionModal";
import EmptyComisionModal from "../EmptyComisionModal";

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
  const [openComisionModal, setOpenComisionModal] = useState(false);
  const [openEmptyComisionModal, setOpenEmptyComisionModal] = useState(false);
  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTramite((prevState) => {
      if (name === "status") {
        return {
          ...prevState,
          status: value as Status,
          liquidez_status: value === "Activo" ? "Pendiente de Cobro" : null,
          activation_date: value === "Activo" ? NOW_DATE.toISOString() : "",
          renovation_date:
            value === "Activo" ? RENOVATION_DATE.toISOString() : "",
          tramitation_date:
            value === "Procesando" ||
            value === "Activo" ||
            value === "Pendiente de Firma" ||
            value === "Verificado"
              ? new Date().toISOString()
              : "",
          comision: value === "Baja" ? -prevState.comision : prevState.comision,
          comision_sales_person:
            value === "Baja"
              ? -prevState.comision_sales_person
              : prevState.comision_sales_person,
        };
      } else {
        return {
          ...prevState,
          [name]: value,
        };
      }
    });
  };

  const handleComisionChange = (
    value: number | React.ChangeEvent<HTMLInputElement>
  ) => {
    const numValue =
      typeof value === "number" ? value : Number(value.target.value);
    setTramite((prevState) => ({
      ...prevState,
      comision: numValue,
    }));
  };

  const handleComisionSalesChange = (
    value: number | React.ChangeEvent<HTMLInputElement>
  ) => {
    const numValue =
      typeof value === "number" ? value : Number(value.target.value);
    setTramite((prevState) => ({
      ...prevState,
      comision_sales_person: numValue,
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

  const openCheckComisionModal = () => {
    setOpenComisionModal(true);
  };

  const handleEmptyComisionModal = () => {
    setOpenEmptyComisionModal(true);
  };

  return (
    <>
      <FormWrapper>
        <form>
          <div className="flex flex-col gap-y-4 w-full">
            <div className="flex items-stretch gap-4 w-full">
              <SelectComponent
                onChange={handleFieldChange}
                name="status"
                label="Estado"
                items={
                  userData.role === "2"
                    ? COMERCIAL_STATUS_TYPES
                    : PLAIN_STATUS_TYPES
                }
                selectedKey={tramite.status}
                isRequired
              />
              {userData &&
                (userData.role === "admin" || userData.role === "1") && (
                  <>
                    <NumberInput
                      label="Comisión"
                      name="comision"
                      value={tramite.comision}
                      onChange={(value) => handleComisionChange(value)}
                      isRequired={tramite.status === "Activo"}
                      size="lg"
                      radius="sm"
                      variant="bordered"
                      color="primary"
                    />
                    <NumberInput
                      label="Comisión Comercial"
                      name="comision_sales_person"
                      value={tramite.comision_sales_person}
                      onChange={(value) => handleComisionSalesChange(value)}
                      isRequired={tramite.status === "Activo"}
                      size="lg"
                      radius="sm"
                      variant="bordered"
                      color="primary"
                    />
                  </>
                )}
            </div>
          </div>
          <Divider className="my-4" />
          <h3 className="text-xl font-semibold text-[var(--primary-color-500)] mb-4">
            Contratos
          </h3>
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
          onSubmit={
            tramite.status !== "Tramitable" &&
            tramite.status !== "Borrador" &&
            tramite.status !== "Activo"
              ? openCheckComisionModal
              : tramite.status === "Activo" &&
                (tramite.comision === 0 || tramite.comision_sales_person === 0)
              ? handleEmptyComisionModal
              : onSubmit
          }
        />
      </FormWrapper>

      <CheckComisionModal
        tramite={tramite}
        isOpen={openComisionModal}
        onClose={() => setOpenComisionModal(false)}
        onSubmit={onSubmit}
      />

      <EmptyComisionModal
        tramite={tramite}
        isOpen={openEmptyComisionModal}
        onClose={() => setOpenEmptyComisionModal(false)}
      />
    </>
  );
}
