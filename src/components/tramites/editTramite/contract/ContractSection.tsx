"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, CircleX, FilePen, FileText, MapPin } from "lucide-react";
import { ContractDB } from "@/lib/core/types";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import CreateContractDrawer from "../../createTramite/CreateContractDrawer";
import { Button } from "@heroui/button";
import { showCustomToast } from "@/components/core/CustomToast";
import EditContractDrawer from "./EditContractDrawer";

interface Props {
  contracts: ContractDB[];
  tramite_id: string;
  onContractAdded: () => void;
  onContractUpdated: () => void;
  isEditable: boolean | null;
}
export default function ContractSection({
  contracts,
  tramite_id,
  onContractAdded,
  onContractUpdated,
  isEditable,
}: Props) {
  const [isCreateContractOpen, setIsCreateContractOpen] = useState(false);
  const [isEditContractOpen, setIsEditContractOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractDB>(
    contracts[0]
  );

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

  const handleCreateContract = async (contract: ContractDB) => {
    try {
      const formData = new FormData();
      formData.append("contracts", JSON.stringify([contract]));
      formData.append("tramite_id", tramite_id);
      const res = await fetch(`/api/tramites/add/contract`, {
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
      setIsCreateContractOpen(false);
      onContractAdded();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al añadir contrato",
        message: "Ha ocurrido un error al añadir el contrato",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
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
      setIsEditContractOpen(false);
      return;
    }

    try {
      const res = await fetch(`/api/tramites/update/contract`, {
        method: "PATCH",
        body: JSON.stringify({ contract }),
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
      setIsEditContractOpen(false);
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
    }
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2  text-primary-800">
            <FileText className="h-5 w-5" />
            Contratos
          </CardTitle>
          <CardDescription className="text-primary-400">
            {contracts.length} contrato{contracts.length !== 1 ? "s" : ""}{" "}
            asociado{contracts.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contracts.length > 0 ? (
            <Tabs defaultValue={contracts[0]?.id}>
              <TabsList className="mb-4">
                {contracts.map((contract) => (
                  <TabsTrigger
                    key={contract.id}
                    value={contract.id}
                    onClick={() => setSelectedContract(contract)}
                  >
                    {contract.type} - {contract.CUPS}
                  </TabsTrigger>
                ))}
              </TabsList>

              {contracts.map((contract) => (
                <TabsContent
                  key={contract.id}
                  value={contract.id}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium text-primary-800">
                          Información del Suministro
                        </h3>
                        <Separator className="my-2 bg-primary-200" />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-primary-400">
                          Tipo
                        </p>
                        <p className="font-medium ">{contract.type}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-primary-400">
                            Compañía Antigua
                          </p>
                          <p className="font-medium ">{contract.old_company}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-primary-400">
                            Compañía Nueva
                          </p>
                          <p className="font-medium ">{contract.new_company}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-primary-400">
                          Plan Contratado
                        </p>
                        <p className="font-medium ">{contract.plan}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary-400">
                          CUPS
                        </p>
                        <p className="font-medium ">{contract.CUPS}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary-400">
                          Consumo Estimado
                        </p>
                        <p className="font-medium ">
                          {contract.consumption > 0
                            ? `${contract.consumption} kWh`
                            : "Sin Asignar"}
                        </p>
                      </div>
                      {contract.description && (
                        <div>
                          <p className="text-sm font-medium text-primary-400">
                            Descripción
                          </p>
                          <p className="text-muted-foreground">
                            {contract.description}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium text-primary-800">
                          Dirección del Suministro
                        </h3>
                        <Separator className="my-2 bg-primary-200" />
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary-400" />
                        <p className="font-medium ">
                          {contract.address}, {contract.postal_code}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary-400" />
                        <p className="font-medium ">
                          {contract.city}, {contract.province}
                        </p>
                      </div>

                      <div className="mt-6">
                        <h3 className="text-lg font-medium text-primary-800">
                          Potencias Contratadas
                        </h3>
                        <Separator className="my-2" />
                      </div>
                      {!checkEmptyPots(contract) ? (
                        <div className="grid grid-cols-3 gap-4">
                          {contract.pot1 > 0 && (
                            <div>
                              <p className="text-sm font-medium text-primary-400">
                                Potencia P1
                              </p>
                              <p className="font-medium ">{contract.pot1} kW</p>
                            </div>
                          )}
                          {contract.pot2 > 0 && (
                            <div>
                              <p className="text-sm font-medium text-primary-400">
                                Potencia P2
                              </p>
                              <p className="font-medium ">{contract.pot2} kW</p>
                            </div>
                          )}
                          {contract.pot3 > 0 && (
                            <div>
                              <p className="text-sm font-medium text-primary-400">
                                Potencia P3
                              </p>
                              <p className="font-medium ">{contract.pot3} kW</p>
                            </div>
                          )}
                          {contract.pot4 > 0 && (
                            <div>
                              <p className="text-sm font-medium text-primary-400">
                                Potencia P4
                              </p>
                              <p className="font-medium ">{contract.pot4} kW</p>
                            </div>
                          )}
                          {contract.pot5 > 0 && (
                            <div>
                              <p className="text-sm font-medium text-primary-400">
                                Potencia P5
                              </p>
                              <p className="font-medium ">{contract.pot5} kW</p>
                            </div>
                          )}
                          {contract.pot6 > 0 && (
                            <div>
                              <p className="text-sm font-medium text-primary-400">
                                Potencia P6
                              </p>
                              <p className="font-medium ">{contract.pot6} kW</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-16 text-primary-400">
                          No hay potencias asignadas
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-48 text-primary-400">
              No hay contratos asociados
            </div>
          )}
        </CardContent>
        {isEditable && (
          <CardFooter className="gap-4">
            <Button
              variant="bordered"
              color="primary"
              radius="sm"
              onPress={() => setIsCreateContractOpen(true)}
              startContent={<FileText size={16} />}
            >
              Añadir Contrato
            </Button>
            {contracts.length > 0 && (
              <Button
                variant="bordered"
                color="primary"
                radius="sm"
                onPress={() => setIsEditContractOpen(true)}
                startContent={<FilePen size={16} />}
              >
                Editar Contrato
              </Button>
            )}
          </CardFooter>
        )}
      </Card>

      <CreateContractDrawer
        tramite_id={tramite_id}
        onCreateContract={handleCreateContract}
        isOpenProp={isCreateContractOpen}
        onCloseProp={() => setIsCreateContractOpen(false)}
      />

      <EditContractDrawer
        contract={selectedContract}
        isOpenProp={isEditContractOpen}
        onCloseProp={() => setIsEditContractOpen(false)}
        onSavingContract={handleUpdateContract}
      />
    </>
  );
}
