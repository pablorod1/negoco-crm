import { FotovoltaicaVM } from "@/fotovoltaica/types";
import { User } from "@/core/types";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { formatDateTime } from "@/core/utils/format";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import { User as UserIcon, Info, Euro, Building } from "lucide-react";
import UpdateFotovoltaicaStatusDialog from "../UpdateFotovoltaicaStatusDialog";
import { cn } from "@/core/utils";
import AvatarComponent from "@/core/components/AvatarComponent";

// Componentes específicos de fotovoltaicas
import FotovoltaicaLocationTab from "../FotovoltaicaLocationTab";
import {
  FOTOVOLTAICA_CLIENT_TYPES,
  FOTOVOLTAICA_TYPES,
} from "@/fotovoltaica/constants";

interface FotovoltaicaMainViewProps {
  fotovoltaica: FotovoltaicaVM;
  userData: User;
  onUpdate: () => void;
  isSubcomercial: boolean;
}

export default function FotovoltaicaMainView({
  fotovoltaica,
  userData,
  onUpdate,
  isSubcomercial,
}: FotovoltaicaMainViewProps) {
  const isComercial = userData.role === "2";
  const isCompleted = fotovoltaica.status === "completed";
  const isRejected = fotovoltaica.status === "rejected";

  const getTypeLabel =
    FOTOVOLTAICA_TYPES.find(
      (fotovoltaicaType) => fotovoltaicaType.value === fotovoltaica.type
    )?.label || "No especificado";

  const getClientTypeLabel =
    FOTOVOLTAICA_CLIENT_TYPES.find(
      (clientType) => clientType.value === fotovoltaica.client_type
    )?.label || "No especificado";

  return (
    <div className="space-y-6">
      {/* Hero Section - 3 Cards principales */}
      <div
        className={cn(
          "grid grid-cols-1 gap-6",
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
                {getStatusBadge(fotovoltaica.status, "fotovoltaica")}
              </div>
            </div>

            {/* Separador visual */}
            <div className="border-t border-gray-100"></div>

            {/* Acciones disponibles */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Acciones disponibles
              </p>

              <div className="space-y-2">
                {!isComercial && !isCompleted && !isRejected && (
                  <UpdateFotovoltaicaStatusDialog
                    fotovoltaica={fotovoltaica}
                    onSubmit={onUpdate}
                    userData={userData}
                  />
                )}
                {/* Solicitud completada */}
                {isCompleted && (
                  <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-green-100">
                        <Info className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          Solicitud Completada
                        </p>
                        <p className="text-xs text-green-600">
                          Instalación finalizada con éxito
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Solicitud rechazada */}
                {isRejected && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-red-100">
                        <Info className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900">
                          Solicitud Rechazada
                        </p>
                        <p className="text-xs text-red-600">
                          No cumple con los requisitos
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sin acciones disponibles para comerciales o estados finales */}
                {(isComercial || isCompleted || isRejected) && (
                  <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-center">
                    <p className="text-sm text-gray-500">
                      No hay acciones disponibles
                    </p>
                    <p className="text-xs text-gray-400">
                      {isComercial
                        ? "Esperando respuesta del backoffice"
                        : "Estado final de la solicitud"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Comisiones (solo si no es subcomercial) */}
        {!isSubcomercial && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Información Financiera
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comisión General */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Comisión General
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {fotovoltaica.comision}€
                </p>
              </div>

              {/* Separador visual */}
              <div className="border-t border-gray-100"></div>

              {/* Comisión Comercial */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Comisión Comercial
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {fotovoltaica.comision_sales_person}€
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card 3: Usuario y Fechas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Usuario y Fechas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Usuario asignado */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Usuario asignado
              </p>
              <div className="flex items-start gap-3">
                <AvatarComponent
                  userData={fotovoltaica.user}
                  className="w-8 h-8"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {fotovoltaica.user.name}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {fotovoltaica.user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Separador visual */}
            <div className="border-t border-gray-100"></div>

            {/* Fechas importantes */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Fechas importantes
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Creación:</span>
                  <span className="font-medium text-gray-900">
                    {formatDateTime(fotovoltaica.creation_date)}
                  </span>
                </div>
                {fotovoltaica.activation_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Activación:</span>
                    <span className="font-medium text-gray-900">
                      {formatDateTime(fotovoltaica.activation_date)}
                    </span>
                  </div>
                )}
                {fotovoltaica.updated_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Actualización:</span>
                    <span className="font-medium text-gray-900">
                      {formatDateTime(fotovoltaica.updated_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secciones detalladas - 2 Cards por debajo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información del Cliente */}
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building className="h-5 w-5 text-gray-600" />
              Información del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Cliente
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {fotovoltaica.client}
              </p>
            </div>

            {/* Tipos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Tipo de Cliente
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {getClientTypeLabel}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Tipo de Instalación
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {getTypeLabel}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ubicación */}
        <FotovoltaicaLocationTab fotovoltaica={fotovoltaica} />
      </div>
    </div>
  );
}
