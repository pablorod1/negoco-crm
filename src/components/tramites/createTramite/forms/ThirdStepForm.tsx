"use client";
import {
  NOW_DATE,
  COMERCIAL_STATUS_TYPES,
  RENOVATION_DATE,
  PLAIN_STATUS_TYPES,
} from "@/lib/core/const";
import { Divider } from "@heroui/divider";
import { ContractDB, Status, TramiteDB, User } from "@/lib/core/types";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import ContractPreview from "../ContractPreview";
import { InputComponent, SelectComponent } from "../InputComponent";
import { useState } from "react";
import CheckComisionModal from "../CheckComisionModal";
import EmptyComisionModal from "../EmptyComisionModal";
import { Euro, FileX2, Pencil } from "lucide-react";
import ContractForm from "./ContractForm";
import { Button } from "@/components/ui/button";

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
  const [showContractForm, setShowContractForm] = useState(false);
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractDB | null>(
    null
  );

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
    setShowContractForm(false);
  };

  const handleUpdateContract = (updatedContract: ContractDB) => {
    const updatedContracts = contracts.map((contract) =>
      contract.id === updatedContract.id ? updatedContract : contract
    );
    setContracts(updatedContracts);
    setShowContractForm(false);
    setIsEditingContract(false);
    setSelectedContract(null);
  };

  const handleCreateContract = () => {
    setShowContractForm(true);
  };

  const handleEditContract = (contract: ContractDB) => {
    setIsEditingContract(true);
    setShowContractForm(true);
    setSelectedContract(contract);
  };

  const handleSelectChange = (value: string, name: string) => {
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

  if (showContractForm && !isEditingContract) {
    return (
      <FormWrapper>
        <ContractForm
          onCreateContract={handleAddContract}
          tramite_id={tramite.id}
          onCancel={() => setShowContractForm(false)}
        />
      </FormWrapper>
    );
  }

  if (showContractForm && isEditingContract) {
    return (
      <FormWrapper>
        <ContractForm
          onCreateContract={handleUpdateContract}
          tramite_id={tramite.id}
          onCancel={() => setShowContractForm(false)}
          contract={selectedContract}
        />
      </FormWrapper>
    );
  }

  return (
    <>
      <FormWrapper>
        <form>
          <div className="flex flex-col gap-y-4 w-full">
            <div className="flex items-stretch gap-4 w-full">
              <SelectComponent
                onChange={(value) => handleSelectChange(value, "status")}
                name="status"
                label="Estado"
                items={
                  userData.role === "2"
                    ? COMERCIAL_STATUS_TYPES
                    : PLAIN_STATUS_TYPES
                }
                selectedKey={tramite.status || ""}
                isRequired
              />
              {userData &&
                (userData.role === "admin" || userData.role === "1") && (
                  <>
                    <InputComponent
                      type="number"
                      label="Comisión"
                      name="comision"
                      value={tramite.comision || ""}
                      onChange={handleComisionChange}
                      isRequired={tramite.status === "Activo"}
                      endContent={<Euro size={16} />}
                    />
                    <InputComponent
                      type="number"
                      label="Comisión Comercial"
                      name="comision_sales_person"
                      value={tramite.comision_sales_person || ""}
                      onChange={handleComisionSalesChange}
                      isRequired={tramite.status === "Activo"}
                      endContent={<Euro size={16} />}
                    />
                  </>
                )}
            </div>
          </div>
          <Divider className="my-8" />
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-xl font-semibold text-primary-500 ">
              Contratos
            </h3>
            <Button variant="outline" onClick={handleCreateContract}>
              Añadir Contrato
            </Button>
          </div>

          {contracts.length > 0 ? (
            <div className="flex items-start gap-4 w-full">
              {contracts.map((contract, index) => (
                <div key={index} className="flex items-center flex-col gap-2 ">
                  <ContractPreview contract={contract} />
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => handleEditContract(contract)}
                  >
                    <Pencil size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center max-w-xl mx-auto text-center w-full h-32 border border-dashed rounded-lg shadow">
              <FileX2 size={32} className="text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 text-balance">
                Puedes añadir un contrato haciendo click en el botón{" "}
                <strong>Añadir Contrato</strong> y lo podrás editar después
                haciendo click en el icono de editar.
              </p>
            </div>
          )}
        </form>
        {tramite.status !== "Tramitable" &&
        tramite.status !== "Borrador" &&
        tramite.status !== "Activo" ? (
          <CheckComisionModal
            tramite={tramite}
            onSubmit={onSubmit}
            onBack={onBack}
            onCancel={onCancel}
          />
        ) : tramite.status === "Activo" &&
          (tramite.comision === 0 || tramite.comision_sales_person === 0) ? (
          <EmptyComisionModal
            tramite={tramite}
            onBack={onBack}
            onCancel={onCancel}
          />
        ) : (
          <ButtonGroupComponent
            onCancel={onCancel}
            onBack={onBack}
            onSubmit={onSubmit}
          />
        )}
      </FormWrapper>
    </>
  );
}
