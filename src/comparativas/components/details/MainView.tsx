import { ComparativaVM, ComparativaFile } from "@/comparativas/types";
import { User } from "@/core/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { ServiceInfo } from "@/comparativas/components/editComparativa/ServiceInfo";
import { formatDateTime } from "@/core/utils/format";
import AvatarComponent from "@/core/components/AvatarComponent";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import {
  User as UserIcon,
  Info,
  ClipboardList,
  FileText,
  CheckCircle,
} from "lucide-react";
import UpdateComparativaStatusModal from "@/comparativas/components/editComparativa/UpdateComparativaStatusModal";
import CompletarEstudioModal from "@/comparativas/components/editComparativa/CompletarEstudioModal";
import AddTramiteDialog from "@/tramites/components/createTramite/AddTramiteDialog";
import TooltipComponent from "@/core/components/TooltipComponent";
import { Link } from "next-view-transitions";
import { FilesList } from "@/comparativas/components/editComparativa/FilesList";
import UploadComparativaFilesModal from "@/comparativas/components/editComparativa/UploadComparativaFilesModal";
import ComparativaComissionsSection from "@/comparativas/components/editComparativa/ComparativaComissionsSection";
import { cn } from "@/core/utils";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";
import { useSidebarSlideNavigation } from "@/core/view-transitions/useGenieEffect";

interface MainViewProps {
  comparativa: ComparativaVM;
  userData: User;
  onUpdate: () => void;
  isSubcomercial: boolean;
  isEditable: boolean;
  isComercialEditable: boolean;
  isProcessed: boolean;
}

export default function MainView({
  comparativa,
  userData,
  onUpdate,
  isSubcomercial,
  isEditable,
  isComercialEditable,
  isProcessed,
}: MainViewProps) {
  const isComercial = userData.role === "2";
  const isStudied = comparativa.status === "completed";
  const isAdmin = userData.role === "admin" || userData.role === "1";
  // Los admins pueden editar comisiones cuando la comparativa está estudiada
  const canEditComissions = isAdmin && isStudied;

  // Fetch supplier information if company_id is available
  const { supplier, loading: isLoadingSupplier } = useEnergySupplierById(
    comparativa.company_id
  );

  const handleSidebarClick = useSidebarSlideNavigation();

  return (
    <div className="space-y-6">
      {/* Hero Section - 3 Cards */}
      <div
        className={cn(
          "grid grid-cols-1  gap-6",
          isSubcomercial ? "lg:grid-cols-2" : "lg:grid-cols-3"
        )}
      >
        {/* Card 1: Estado y Acciones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Estado y Acciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estado actual */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Estado actual
              </p>
              <div className="flex items-center gap-2">
                {getStatusBadge(comparativa.status, "comparativa")}
              </div>
            </div>

            {/* Separador visual */}
            <div className="border-t border-gray-100"></div>

            {/* Acciones disponibles */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Acciones disponibles
              </p>

              <div className="space-y-2 space-x-2">
                {/* Comparativa procesada - Ver trámite */}
                {comparativa.status === "processed" &&
                  comparativa.tramite_id && (
                    <TooltipComponent content="Ver el trámite generado desde esta comparativa">
                      <Link
                        onClick={handleSidebarClick}
                        href={`/tramites/${comparativa.tramite_id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors group"
                      >
                        <div className="p-1.5 rounded-md bg-blue-100 group-hover:bg-blue-200 transition-colors">
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            Ver Trámite Asociado
                          </p>
                          <p className="text-xs text-blue-600">
                            Comparativa convertida exitosamente
                          </p>
                        </div>
                      </Link>
                    </TooltipComponent>
                  )}

                {/* Comparativa pendiente - Acciones de backoffice */}
                {comparativa.status === "pending" && !isComercial && (
                  <div className="space-y-2 space-x-2">
                    <CompletarEstudioModal
                      comparativa={comparativa}
                      onUpdate={onUpdate}
                      userData={userData}
                    />
                  </div>
                )}

                {/* Comparativa completada - Crear trámite */}
                {isStudied && (
                  <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-md bg-green-100">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          Estudio Completado
                        </p>
                        <p className="text-xs text-green-600">
                          Listo para convertir en trámite
                        </p>
                      </div>
                    </div>
                    <AddTramiteDialog
                      variant="default"
                      comparativa={comparativa}
                      onComparativaUpdated={onUpdate}
                    />
                  </div>
                )}

                {/* Otros estados - Modal genérico */}
                {comparativa.status !== "completed" &&
                  comparativa.status !== "processed" &&
                  comparativa.status !== "pending" &&
                  !isComercial && (
                    <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-1.5 rounded-md bg-gray-100">
                          <Info className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Actualizar Estado
                          </p>
                          <p className="text-xs text-gray-600">
                            Cambiar estado de la comparativa
                          </p>
                        </div>
                      </div>
                      <UpdateComparativaStatusModal
                        comparativa={comparativa}
                        onUpdate={onUpdate}
                        userData={userData}
                      />
                    </div>
                  )}

                {/* Sin acciones disponibles */}
                {(comparativa.status === "rejected" ||
                  (isComercial && comparativa.status !== "completed")) && (
                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-center">
                    <p className="text-sm text-gray-500">
                      No hay acciones disponibles
                    </p>
                    <p className="text-xs text-gray-400">
                      {comparativa.status === "rejected"
                        ? "Comparativa rechazada"
                        : "Esperando respuesta del backoffice"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Comisiones */}
        {!isSubcomercial ? (
          <ComparativaComissionsSection
            userData={userData}
            comparativa={comparativa}
            onUpdate={onUpdate}
            canEdit={canEditComissions}
          />
        ) : null}

        {/* Card 3: Información General */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className=" relative overflow-hidden">
            {/* {supplier ? (
              <Image
                src={`/companies/${supplier.logo}`}
                alt={supplier.name}
                width={512}
                height={512}
                className="absolute inset-0 opacity-5 object-cover w-full h-full"
              />
            ) : null} */}
            <div className="grid grid-cols-2 gap-6 space-x-12 gap-x-16">
              <div>
                <p className="text-xs text-gray-500 mb-1">Servicio</p>
                <ServiceInfo service={comparativa.service} size="sm" />
              </div>
              {/* Supplier information section */}
              {comparativa.company_id && supplier ? (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Comercializadora</p>
                  <p className="text-sm font-medium text-gray-900">
                    {supplier.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {isLoadingSupplier ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                        <span className="text-sm text-gray-500">
                          Cargando...
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-gray-500 mb-1">Creado por</p>
                <div className="flex items-center gap-2">
                  <AvatarComponent
                    userData={comparativa.user as User}
                    className="!rounded-full w-6 h-6"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {comparativa.user.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {comparativa.user.email}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Fecha de Creación</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDateTime(comparativa.creation_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between"></div>
          </CardContent>
        </Card>
      </div>

      {/* Documentos Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos
          </CardTitle>
          <CardDescription className="text-gray-500">
            {comparativa.files.length} archivo
            {comparativa.files.length !== 1 ? "s" : ""} adjunto
            {comparativa.files.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilesList
            files={(comparativa.files as ComparativaFile[]) || []}
            comparativa_id={comparativa.id}
            organization_id={userData.organization.id}
            onDeleted={onUpdate}
            isComercial={isComercial}
            isProcessed={isProcessed}
          />
        </CardContent>
        <CardFooter>
          {(isEditable || isComercialEditable) && (
            <UploadComparativaFilesModal
              onUpload={onUpdate}
              userData={userData}
              comparativa={comparativa}
            />
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
