"use client";
import {
  COMERCIAL_STATUS_TYPES,
  PLAIN_STATUS_TYPES,
} from "@/tramites/constants";
import { NOW_DATE, RENOVATION_DATE } from "@/dashboard/constants";
import { ContractDB, Status, TramiteDB } from "@/tramites/types";
import { User } from "@/core/types";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import FormWrapper from "../FormWrapper";
import ContractPreview from "../ContractPreview";
import { InputComponent, SelectComponent } from "../InputComponent";
import { useEffect, useMemo, useState } from "react";
import CheckComisionModal from "../CheckComisionModal";
import EmptyComisionModal from "../EmptyComisionModal";
import { Euro, FileX2, Pencil } from "lucide-react";
import ContractForm from "./ContractForm";
import { Button } from "@/core/components/ui/button";
import { Separator } from "@/core/components/ui/separator";
import { ComparativaVM } from "@/comparativas/types";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useUserCompanyCommissions } from "@/core/hooks/use-user-company-commissions";
import { calculateSalesPersonCommission } from "@/core/utils/sales-commission";
import { useCrmSettings } from "@/crm-settings/hooks/useCrmSettings";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";

const NO_PROVIDER_VALUE = "__none__";

interface Props {
  onBack: () => void;
  tramite: TramiteDB;
  setTramite: React.Dispatch<React.SetStateAction<TramiteDB>>;
  onSubmit: () => void;
  onCancel: () => void;
  contracts: ContractDB[];
  setContracts: React.Dispatch<React.SetStateAction<ContractDB[]>>;
  userData: User;
  comparativa?: ComparativaVM;
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
  comparativa,
}: Props) {
  const [showContractForm, setShowContractForm] = useState(
    !!comparativa?.abarca_estudio,
  );
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractDB | null>(
    null,
  );
  const [salesCommissionTouched, setSalesCommissionTouched] = useState(false);
  const { activeSuppliers } = useActiveEnergySuppliers();
  const { settings } = useCrmSettings();
  const { commissions: userCompanyCommissions } = useUserCompanyCommissions(
    tramite.user_id,
  );
  const configuredProviders = useMemo(
    () => settings?.providers.map((provider) => provider.name) ?? [],
    [settings],
  );
  const providerOptions = useMemo(() => {
    if (!tramite.provider || configuredProviders.includes(tramite.provider)) {
      return configuredProviders;
    }

    return [tramite.provider, ...configuredProviders];
  }, [configuredProviders, tramite.provider]);

  const firstContract = contracts[0];
  const contractSupplierId = activeSuppliers.find(
    (supplier) => supplier.id === firstContract?.new_company,
  )?.id;
  const providerSupplierId = activeSuppliers.find(
    (supplier) =>
      supplier.name.trim().toLowerCase() ===
      (tramite.provider || "").trim().toLowerCase(),
  )?.id;
  const supplierId =
    comparativa?.company_id || providerSupplierId || contractSupplierId;
  const supplierName = tramite.provider || firstContract?.new_company;

  useEffect(() => {
    if (salesCommissionTouched) return;

    const calculatedCommission = calculateSalesPersonCommission({
      baseCommission: tramite.comision,
      supplierId,
      supplierName,
      commissions: userCompanyCommissions,
      suppliers: activeSuppliers,
    });

    if (calculatedCommission === null) return;

    setTramite((prevState) => {
      if (prevState.comision_sales_person === calculatedCommission) {
        return prevState;
      }

      return {
        ...prevState,
        comision_sales_person: calculatedCommission,
      };
    });
  }, [
    activeSuppliers,
    supplierId,
    supplierName,
    salesCommissionTouched,
    setTramite,
    tramite.comision,
    userCompanyCommissions,
  ]);

  const handleProviderChange = (
    value: string | React.ChangeEvent<HTMLInputElement>,
  ) => {
    const providerValue =
      typeof value === "string" ? value : value.target.value;
    setTramite((prevState) => ({
      ...prevState,
      provider: providerValue,
    }));
  };

  const handleComisionChange = (
    value: number | React.ChangeEvent<HTMLInputElement>,
  ) => {
    const numValue =
      typeof value === "number" ? value : Number(value.target.value);
    setTramite((prevState) => ({
      ...prevState,
      comision: numValue,
    }));
  };

  const handleComisionSalesChange = (
    value: number | React.ChangeEvent<HTMLInputElement>,
  ) => {
    setSalesCommissionTouched(true);
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
      contract.id === updatedContract.id ? updatedContract : contract,
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

  if (showContractForm) {
    return (
      <FormWrapper>
        <ContractForm
          onCreateContract={
            isEditingContract ? handleUpdateContract : handleAddContract
          }
          tramite_id={tramite.id}
          onCancel={() => setShowContractForm(false)}
          contract={isEditingContract ? selectedContract : null}
          comparativa={comparativa}
        />
      </FormWrapper>
    );
  }

  return (
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
                  {configuredProviders.length > 0 ? (
                    <div className="flex w-full flex-col gap-2">
                      <Label htmlFor="provider">Proveedor</Label>
                      <Select
                        value={tramite.provider || NO_PROVIDER_VALUE}
                        onValueChange={(value) =>
                          handleProviderChange(
                            value === NO_PROVIDER_VALUE ? "" : value,
                          )
                        }
                      >
                        <SelectTrigger id="provider" className="rounded-md">
                          <SelectValue placeholder="Seleccionar proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PROVIDER_VALUE}>
                            Sin proveedor
                          </SelectItem>
                          {providerOptions.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {provider}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <InputComponent
                      type="text"
                      label="Proveedor"
                      name="provider"
                      value={tramite.provider || ""}
                      onChange={handleProviderChange}
                      isRequired={false}
                    />
                  )}
                </>
              )}
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-xl font-semibold text-primary-500 ">Contratos</h3>
          {contracts.length === 0 && (
            <Button variant="outline" onClick={handleCreateContract}>
              Añadir Contrato
            </Button>
          )}
        </div>

        {contracts.length > 0 ? (
          <div className="w-full">
            {contracts.map((contract) => (
              <div
                key={contract.id || contract.CUPS}
                className="flex items-center flex-col gap-2 "
              >
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
  );
}
