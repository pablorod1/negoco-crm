"use client";

import { Status, User } from "@/core/types";
import {
  TramiteDB,
  TramiteFile,
  ClientDB,
  SignerDB,
  ContractDB,
} from "@/tramites/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { Badge } from "@/core/components/ui/badge";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import {
  formatComission,
  formatFileSize,
  formatUUID,
} from "@/core/utils/format";
import { IdCardIcon, Mail, Phone } from "lucide-react";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";
import FormTicketsSection from "@/core/components/FormTicketsSection";

interface Props {
  tramite: TramiteDB;
  client: ClientDB;
  signer?: SignerDB | null;
  contracts: ContractDB[];
  documents: File[];
  selectedExistingFiles: TramiteFile[] | null;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
  loading: boolean;
  userData: User;
  loadingStep?: number;
  loadingMessage?: string;
}

export default function ReviewStep({
  tramite,
  client,
  signer,
  contracts,
  documents,
  selectedExistingFiles,
  onSubmit,
  onBack,
  onCancel,
  loading,
  userData,
  loadingStep,
  loadingMessage,
}: Props) {
  const isComercial = userData && userData.role === "2";
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
  const { supplier: newSupplier } = useEnergySupplierById(
    contracts.length > 0 ? contracts[0].new_company : ""
  );

  const { supplier: oldSupplier } = useEnergySupplierById(
    contracts.length > 0 ? contracts[0].old_company || "" : ""
  );

  const totalDocuments =
    documents.length + (selectedExistingFiles || []).length;
  return (
    <>
      {loading && (
        <LoadingStateModal
          title={
            loadingMessage && loadingMessage.length > 0
              ? loadingMessage
              : "Creando trámite..."
          }
          description={
            typeof loadingStep === "number" && loadingStep > 0
              ? `Paso ${loadingStep} de 4`
              : "Espere unos segundos mientras creamos el trámite."
          }
        />
      )}
      <ScrollArea className="h-full w-full max-h-[calc(100vh-400px)]">
        <div className="space-y-6 pb-6 px-4">
          {/* Tramite Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-primary-800 text-lg">
                  Información del trámite - #{formatUUID(tramite.id)}
                </CardTitle>
                {getStatusBadge(tramite.status as Status, "general")}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium">Comercial</p>
                <p className="text-sm text-muted-foreground">
                  {tramite.sales_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {tramite.plan}
                </p>
              </div>
              {!isComercial && (
                <div>
                  <p className="text-sm font-medium">Comision</p>
                  <p className="text-sm text-muted-foreground">
                    {tramite.comision > 0
                      ? formatComission(tramite.comision)
                      : "---"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  Comision {!isComercial ? "Comercial" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tramite.comision_sales_person > 0
                    ? formatComission(tramite.comision_sales_person)
                    : "---"}
                </p>
              </div>
            </CardContent>
          </Card>
          {/* Client Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-primary-800">
                  Cliente - #{formatUUID(client.id)}
                </CardTitle>
                <Badge variant="info">{client.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium">Nombre Completo</p>
                <p className="text-sm text-muted-foreground">
                  {client.name} {client.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Documentación</p>
                <p className="text-sm text-muted-foreground">
                  {client.document_type}: {client.document_number}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Dirección Completa</p>
                <p className="text-sm text-muted-foreground">
                  {client.address}, {client.postal_code} {client.city},{" "}
                  {client.province}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Contacto</p>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Mail size={16} stroke="#333" />
                    <p className="text-sm text-muted-foreground">
                      {client.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} stroke="#333" />
                    <p className="text-sm text-muted-foreground">
                      {client.phone}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">IBAN</p>
                <p className="text-sm text-muted-foreground">{client.IBAN}</p>
              </div>
            </CardContent>
          </Card>

          {/* Signer Information (if exists) */}
          {signer && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-primary-800">
                    Persona Firmante - #{formatUUID(signer.id)}
                  </CardTitle>
                  {signer.cargo && (
                    <Badge variant="pending">{signer.cargo}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium">Nombre Completo</p>
                  <p className="text-sm text-muted-foreground">
                    {signer.name} {signer.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Documentación</p>
                  <div className="flex items-center gap-2">
                    <IdCardIcon size={16} stroke="#333" />
                    <p className="text-sm text-muted-foreground">
                      {signer.document_number}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Contacto</p>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Mail size={16} stroke="#333" />
                      <p className="text-sm text-muted-foreground">
                        {signer.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} stroke="#333" />
                      <p className="text-sm text-muted-foreground">
                        {signer.phone}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contracts Information */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg text-primary-800">
                  Contrato{" "}
                  {contracts.length > 0
                    ? `- #${formatUUID(contracts[0].id)}`
                    : ""}
                </CardTitle>
                {contracts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge>{contracts[0].type}</Badge>
                    <Badge variant="outline">{contracts[0].plan}</Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {contracts.length > 0 ? (
                <>
                  {contracts.map((contract) => (
                    <div key={contract.id} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge>{contract.type}</Badge>
                          <Badge variant="outline">{contract.plan}</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">CUPS</p>
                          <p className="text-sm text-muted-foreground">
                            {contract.CUPS}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Consumo</p>
                          <p className="text-sm text-muted-foreground">
                            {contract.consumption} kWh
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Compañía</p>
                          <p className="text-sm text-muted-foreground">
                            {oldSupplier?.name ?? contract.old_company} --&gt;{" "}
                            {newSupplier?.name}
                          </p>
                        </div>

                        {!checkEmptyPots(contract) ? (
                          <div className="flex items-center gap-4">
                            {contract.pot1 > 0 && (
                              <div>
                                <p className="text-sm font-medium ">
                                  Potencia P1
                                </p>
                                <p className="font-medium text-muted-foreground">
                                  {contract.pot1} kW
                                </p>
                              </div>
                            )}
                            {contract.pot2 > 0 && (
                              <div>
                                <p className="text-sm font-medium ">
                                  Potencia P2
                                </p>
                                <p className="font-medium text-muted-foreground">
                                  {contract.pot2} kW
                                </p>
                              </div>
                            )}
                            {contract.pot3 > 0 && (
                              <div>
                                <p className="text-sm font-medium ">
                                  Potencia P3
                                </p>
                                <p className="font-medium text-muted-foreground">
                                  {contract.pot3} kW
                                </p>
                              </div>
                            )}
                            {contract.pot4 > 0 && (
                              <div>
                                <p className="text-sm font-medium ">
                                  Potencia P4
                                </p>
                                <p className="font-medium text-muted-foreground">
                                  {contract.pot4} kW
                                </p>
                              </div>
                            )}
                            {contract.pot5 > 0 && (
                              <div>
                                <p className="text-sm font-medium ">
                                  Potencia P5
                                </p>
                                <p className="font-medium text-muted-foreground">
                                  {contract.pot5} kW
                                </p>
                              </div>
                            )}
                            {contract.pot6 > 0 && (
                              <div>
                                <p className="text-sm font-medium ">
                                  Potencia P6
                                </p>
                                <p className="font-medium text-muted-foreground">
                                  {contract.pot6} kW
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No hay potencias asignadas
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            Dirección Completa
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contract.address}, {contract.postal_code}{" "}
                            {contract.city}, {contract.province}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-gray-400 text-sm italic">
                  No hay contratos asociados.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary-800 text-lg">
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalDocuments > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-lg"
                    >
                      <span className="text-sm">{doc.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(Number(doc.size))}
                      </span>
                    </div>
                  ))}
                  {selectedExistingFiles &&
                    selectedExistingFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border rounded-lg"
                      >
                        <span className="text-sm">{file.filename}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatFileSize(Number(file.size))}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-gray-400 text-sm italic">
                  No hay documentos asociados.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tickets/Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-primary-800">
                Observaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormTicketsSection
                context="tramite"
                refId={tramite.id}
                assignedTo={tramite.user_id || ""}
                userData={userData}
                maxHeight="300px"
                isReadOnly
              />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
      <ButtonGroupComponent
        onSubmit={onSubmit}
        onBack={onBack}
        onCancel={onCancel}
        lastStep
        loading={loading}
      />
    </>
  );
}
