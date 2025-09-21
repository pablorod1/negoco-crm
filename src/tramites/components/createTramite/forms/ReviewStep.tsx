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
import { formatComission } from "@/core/utils/format";
import {
  CheckCircle,
  UserCheck,
  FileText,
  FileIcon,
  FileTextIcon,
  FolderOpen,
  FileX,
} from "lucide-react";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";

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

      <div className="space-y-6 pb-6">
        {/* Step Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Revisar y confirmar
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Revisa toda la información antes de crear el trámite
          </p>
        </div>

        <ScrollArea className="h-full w-full max-h-[calc(100vh-400px)]">
          <div className="space-y-6 px-1">
            {/* Tramite Summary */}
            <Card className="bg-primary-50 border-primary-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-600" />
                    <CardTitle className="text-lg text-gray-900">
                      Resumen del trámite
                    </CardTitle>
                  </div>
                  {getStatusBadge(tramite.status as Status, "general")}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Comercial
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {tramite.sales_name}
                    </p>
                  </div>
                  {tramite.plan ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Plan
                      </p>
                      <p className="text-sm font-semibold text-gray-900 capitalize">
                        {tramite.plan}
                      </p>
                    </div>
                  ) : null}
                  {!isComercial && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Comisión
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {tramite.comision > 0
                          ? formatComission(tramite.comision)
                          : "---"}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Comisión {!isComercial ? "Comercial" : ""}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {tramite.comision_sales_person > 0
                        ? formatComission(tramite.comision_sales_person)
                        : "---"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Client Information */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary-600" />
                    <CardTitle className="text-lg text-gray-900">
                      Información del cliente
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {client.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                        Nombre completo
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {client.name} {client.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                        Documentación
                      </p>
                      <p className="text-sm text-gray-700">
                        {client.document_type} • {client.document_number}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                        Contacto
                      </p>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-700">{client.email}</p>
                        {client.phone && (
                          <p className="text-sm text-gray-700">
                            {client.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                        Dirección
                      </p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p>{client.address}</p>
                        <p>
                          {client.postal_code} {client.city}
                        </p>
                        <p>{client.province}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Signer Information (if exists) */}
            {signer && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary-600" />
                    <CardTitle className="text-lg text-gray-900">
                      Firmante autorizado
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                          Nombre completo
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {signer.name} {signer.last_name}
                        </p>
                      </div>
                      {signer.cargo && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                            Cargo
                          </p>
                          <p className="text-sm text-gray-700">
                            {signer.cargo}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                          Contacto
                        </p>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700">
                            {signer.email}
                          </p>
                          {signer.phone && (
                            <p className="text-sm text-gray-700">
                              {signer.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">
                          Documento
                        </p>
                        <p className="text-sm text-gray-700">
                          {signer.document_number}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contracts Information */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="h-5 w-5 text-primary-600" />
                    <CardTitle className="text-lg text-gray-900">
                      Contratos
                    </CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {contracts.length} contrato
                    {contracts.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {contracts.length > 0 ? (
                  <div className="space-y-4">
                    {contracts.map((contract, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">
                            Contrato {index + 1}
                          </h4>
                          <Badge variant="outline" className="capitalize">
                            {contract.type}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 mb-1">CUPS</p>
                            <p className="font-medium text-gray-900">
                              {contract.CUPS}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 mb-1">
                              Compañía anterior
                            </p>
                            <p className="font-medium text-gray-900">
                              {oldSupplier?.name ||
                                contract.old_company ||
                                "No especificada"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 mb-1">Nueva compañía</p>
                            <p className="font-medium text-gray-900">
                              {newSupplier?.name ||
                                contract.new_company ||
                                "No especificada"}
                            </p>
                          </div>
                        </div>

                        {contract.plan && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-gray-600 text-sm mb-1">
                              Plan tarifario
                            </p>
                            <p className="font-medium text-gray-900 capitalize">
                              {contract.plan}
                            </p>
                          </div>
                        )}

                        {!checkEmptyPots(contract) && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-gray-600 text-sm mb-2">
                              Potencias (kW)
                            </p>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                              {[1, 2, 3, 4, 5, 6].map((period) => (
                                <div key={period} className="text-center">
                                  <p className="text-gray-500">P{period}</p>
                                  <p className="font-medium">
                                    {contract[
                                      `pot${period}` as keyof ContractDB
                                    ] || 0}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileX className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay contratos definidos</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents Summary */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary-600" />
                  <CardTitle className="text-lg text-gray-900">
                    Documentos
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {totalDocuments > 0 ? (
                  <div className="space-y-4">
                    {documents.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Nuevos archivos ({documents.length})
                        </p>
                        <div className="space-y-2">
                          {documents.map((doc, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-2 bg-green-50 rounded-lg border border-green-200"
                            >
                              <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                                <FileIcon className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="text-sm text-gray-900">
                                {doc.name}
                              </span>
                              <Badge
                                variant="secondary"
                                className="ml-auto bg-green-100 text-green-700"
                              >
                                Nuevo
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedExistingFiles &&
                      selectedExistingFiles.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Archivos existentes ({selectedExistingFiles.length})
                          </p>
                          <div className="space-y-2">
                            {selectedExistingFiles.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-200"
                              >
                                <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                  <FileIcon className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="text-sm text-gray-900">
                                  {file.filename}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="ml-auto bg-blue-100 text-blue-700"
                                >
                                  Existente
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FolderOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay documentos adjuntos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>

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
