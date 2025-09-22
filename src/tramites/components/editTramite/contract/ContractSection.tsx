"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/core/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Building2, CircleX, FilePen, FileText, MapPin } from "lucide-react";
import { useState } from "react";
import { showCustomToast } from "@/core/components/CustomToast";
import EditDrawer from "../client/EditTramiteDrawer";
import { ContractDB } from "@/tramites/types";
import { User } from "@/core/types";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";

interface Props {
  contracts: ContractDB[];
  tramite_id: string;
  onContractUpdated: () => void;
  isEditable: boolean | null;
  userData: User;
}
export default function ContractSection({
  contracts,
  tramite_id,
  onContractUpdated,
  isEditable,
  userData,
}: Props) {
  const [selectedContract, setSelectedContract] = useState<ContractDB>(
    contracts[0]
  );
  const [loading, setLoading] = useState(false);
  const userId = userData?.id;

  // Hook to resolve supplier names from IDs when available
  // Cast to ContractWithSupplierDB to access ID fields that might be present
  const contractWithIds = selectedContract as ContractDB & {
    old_company_id?: string;
    new_company_id?: string;
  };
  const { supplier: oldSupplier } = useEnergySupplierById(
    contractWithIds?.old_company_id
  );
  const { supplier: newSupplier } = useEnergySupplierById(
    contractWithIds?.new_company_id
  );

  // Helper function to get the display name (prioritize resolved supplier name over legacy string)
  const getOldCompanyDisplayName = () => {
    if (oldSupplier) return oldSupplier.name;
    return selectedContract?.old_company || "No especificada";
  };

  const getNewCompanyDisplayName = () => {
    if (newSupplier) return newSupplier.name;
    return selectedContract?.new_company || "No especificada";
  };

  const checkChanges = (contract: ContractDB) => {
    return JSON.stringify(contract) !== JSON.stringify(selectedContract);
  };

  const checkEmptyPots = (contract: ContractDB) => {
    return (
      contract.pot1 === 0 &&
      contract.pot2 === 0 &&
      contract.pot3 === 0 &&
      contract.pot4 === 0 &&
      contract.pot5 === 0 &&
      contract.pot6 === 0
    );
  };

  const handleUpdateContract = async (contract: ContractDB) => {
    if (!checkChanges(contract)) {
      showCustomToast({
        title: "Sin cambios",
        message: "No se han realizado cambios en el contrato",
        icon: CircleX,
        iconColor: "var(--warning-color)",
        iconSize: 24,
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/contracts/${tramite_id}/contract`, {
        method: "PATCH",
        body: JSON.stringify({ contract, user_id: userId }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al actualizar contrato",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Contrato editado",
        message: "El contrato ha sido actualizado correctamente",
        icon: FilePen,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
      onContractUpdated();
      setSelectedContract(contract);
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al editar contrato",
        message: "Ha ocurrido un error al actualizar el contrato",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async (contract: ContractDB) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("contracts", JSON.stringify([contract]));
      const res = await fetch(`/api/v2/contracts/${tramite_id}/contract`, {
        method: "POST",
        body: formData,
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al añadir contrato",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      showCustomToast({
        title: "Contrato añadido",
        message: "El contrato ha sido añadido correctamente",
        icon: FileText,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
      onContractUpdated();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al añadir contrato",
        message: "Ha ocurrido un error al añadir el contrato",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
            Contratos
          </CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-1">
            {contracts.length} contrato{contracts.length !== 1 ? "s" : ""}{" "}
            asociado{contracts.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {contracts.length > 0 ? (
            <Tabs defaultValue={contracts[0]?.id} className="space-y-4">
              <TabsList className="bg-gray-100 p-1 rounded-lg">
                {contracts.map((contract) => (
                  <TabsTrigger
                    key={contract.id}
                    value={contract.id}
                    onClick={() => setSelectedContract(contract)}
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-600 font-medium px-4 py-2"
                  >
                    {contract.type} - {contract.CUPS}
                  </TabsTrigger>
                ))}
              </TabsList>

              {contracts.map((contract) => (
                <TabsContent
                  key={contract.id}
                  value={contract.id}
                  className="mt-0"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Supply Information */}
                    <div className="space-y-4">
                      <div className="pb-3 border-b border-gray-200">
                        <h3 className="text-sm font-medium text-gray-700">
                          Información del Suministro
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tipo</p>
                          <p className="text-sm font-medium text-gray-800">
                            {contract.type}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Compañía Antigua
                            </p>
                            <p className="text-sm font-medium text-gray-800">
                              {getOldCompanyDisplayName()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Compañía Nueva
                            </p>
                            <p className="text-sm font-medium text-gray-800">
                              {getNewCompanyDisplayName()}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            Plan Contratado
                          </p>
                          <p className="text-sm font-medium text-gray-800">
                            {contract.plan}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 mb-1">CUPS</p>
                          <p className="text-sm font-medium text-gray-800 font-mono">
                            {contract.CUPS}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            Consumo Estimado
                          </p>
                          <p className="text-sm font-medium text-gray-800">
                            {contract.consumption > 0
                              ? `${contract.consumption.toLocaleString()} kWh`
                              : "Sin Asignar"}
                          </p>
                        </div>

                        {contract.description && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Descripción
                            </p>
                            <p className="text-sm text-gray-600">
                              {contract.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="space-y-4">
                      <div className="pb-3 border-b border-gray-200">
                        <h3 className="text-sm font-medium text-gray-700">
                          Dirección del Suministro
                        </h3>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {contract.address}
                            </p>
                            <p className="text-xs text-gray-500">
                              {contract.postal_code}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {contract.city}
                            </p>
                            <p className="text-xs text-gray-500">
                              {contract.province}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Power Information */}
                      <div className="pt-4">
                        <div className="pb-3 border-b border-gray-200">
                          <h3 className="text-sm font-medium text-gray-700">
                            Potencias Contratadas
                          </h3>
                        </div>

                        {!checkEmptyPots(contract) ? (
                          <div className="grid grid-cols-2 gap-3 mt-4">
                            {contract.pot1 > 0 && (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">P1</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {contract.pot1} kW
                                </p>
                              </div>
                            )}
                            {contract.pot2 > 0 && (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">P2</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {contract.pot2} kW
                                </p>
                              </div>
                            )}
                            {contract.pot3 > 0 && (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">P3</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {contract.pot3} kW
                                </p>
                              </div>
                            )}
                            {contract.pot4 > 0 && (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">P4</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {contract.pot4} kW
                                </p>
                              </div>
                            )}
                            {contract.pot5 > 0 && (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">P5</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {contract.pot5} kW
                                </p>
                              </div>
                            )}
                            {contract.pot6 > 0 && (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">P6</p>
                                <p className="text-sm font-medium text-gray-800">
                                  {contract.pot6} kW
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-16 text-gray-400 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                            <p className="text-sm">
                              No hay potencias asignadas
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-16 text-gray-400 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm">No hay contratos asociados</p>
            </div>
          )}
        </CardContent>
        {isEditable && (
          <CardFooter className="pt-4 border-t border-gray-200">
            {contracts.length > 0 && selectedContract ? (
              <EditDrawer
                contract={selectedContract}
                onContract={handleUpdateContract}
                loading={loading}
              />
            ) : null}
            {contracts.length === 0 ? (
              <EditDrawer
                tramite_id={tramite_id}
                newContract
                onContract={handleCreateContract}
                loading={loading}
              />
            ) : null}
          </CardFooter>
        )}
      </Card>
    </>
  );
}
