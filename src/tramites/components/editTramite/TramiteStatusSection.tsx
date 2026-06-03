import { User } from "@/core/types";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import UpdateTramiteStatusModal from "./UpdateTramiteStatusModal";
import RenewTramiteConfirmationDialog from "../RenewTramiteConfirmationDialog";
import RejectTramiteModal from "./RejectTramiteModal";
import { ClientDB, TramiteVM } from "@/tramites/types";
import { formatDate } from "@/core/utils/format";
import { InfoIcon, RefreshCcw } from "lucide-react";
import TooltipComponent from "@/core/components/TooltipComponent";

interface Props {
  tramite: TramiteVM;
  client: ClientDB;
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isRenewable: boolean;
  onRenew: () => void;
  isActive: boolean;
  showLiquidez?: boolean; // Nueva prop para mostrar sección de liquidez
  mode?: "full" | "actions";
}

export default function TramiteStatusSection({
  tramite,
  userData,
  onUpdate,
  isEditable,
  isRenewable,
  onRenew,
  client,
  isActive,
  showLiquidez = false,
  mode = "full",
}: Props) {
  const isAdmin = userData.role === "admin";
  const isBackoffice = userData.role === "1";
  const isComercial = userData.role === "2";
  const isBaja = tramite.status === "Baja";
  const clientName = `${client.name} ${client.last_name}`.trim();
  const displayLiquidezStatus =
    isComercial && tramite.liquidez_status === "Cobrado por Comercializadora"
      ? "Pendiente de Cobro"
      : isComercial && tramite.liquidez_status === "Adelantado"
        ? "Pagado al Comercial"
        : tramite.liquidez_status;
  const hasActions =
    isEditable ||
    isBaja ||
    (isActive && !isComercial) ||
    (isRenewable && (isAdmin || isBackoffice)) ||
    (showLiquidez &&
      (tramite.status === "Activo" || tramite.status === "Baja") &&
      !isComercial);

  return (
    <div className="space-y-4">
      {mode === "actions" ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Resto de información
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-gray-500">Estado</p>
              <div className="flex items-center gap-2">
                {getStatusBadge(tramite.status, "general")}
              </div>
            </div>
            {showLiquidez ? (
              <div className="min-w-0">
                <p className="mb-1 text-xs text-gray-500">Liquidez</p>
                <div className="flex items-center gap-2">
                  {getStatusBadge(displayLiquidezStatus, "liquidez")}
                </div>
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="mb-1 text-xs text-gray-500">Cliente</p>
              <p className="truncate text-sm font-medium text-gray-900">
                {clientName || "—"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">Creación</p>
              <p className="text-sm font-medium text-gray-900">
                {tramite.creation_date ? formatDate(tramite.creation_date) : "—"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">Tramitación</p>
              <p className="text-sm font-medium text-gray-900">
                {tramite.tramitation_date
                  ? formatDate(tramite.tramitation_date)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">Renovación</p>
              <p className="text-sm font-medium text-gray-900">
                {tramite.renovation_date
                  ? formatDate(tramite.renovation_date)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "full" ? (
        <div className="grid 2xl:grid-cols-2 gap-6">
          {/* Current Status Display */}
          <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="text-sm text-gray-600 mb-2">Estado Actual</div>
            <div className="flex items-center gap-2">
              {getStatusBadge(tramite.status, "general")}
            </div>
            {isBaja && tramite.rejected_date && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">Fecha de Baja</p>
                <p className="text-sm font-medium text-red-600">
                  {formatDate(tramite.rejected_date)}
                </p>
              </div>
            )}
          </div>

          {/* Liquidez Status Section */}
          {showLiquidez && (
            <div className="flex justify-center items-center bg-gray-50 rounded-2xl p-4 border border-gray-200 relative">
              <div className="absolute top-4 right-4">
                <TooltipComponent
                  content={
                    <div className="max-w-sm p-4">
                      <div className="flex items-start gap-3">
                        <RefreshCcw className="size-5 text-gray-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-900">
                            Actualización Automática
                          </h3>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            El estado de liquidez cambiará automáticamente a{" "}
                            <span className="font-medium">
                              Pendiente de Cobro
                            </span>{" "}
                            cuando el estado del trámite cambie a{" "}
                            <span className="font-medium">Activo</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  }
                  color="bg-white shadow-lg border border-gray-200"
                >
                  <InfoIcon className="size-4 text-gray-400 hover:text-gray-600 cursor-help" />
                </TooltipComponent>
              </div>
              <div className="flex items-center justify-center">
                {isComercial &&
                tramite.liquidez_status === "Cobrado por Comercializadora" ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-500 text-center">
                      Estado actual de liquidez
                    </p>
                    {getStatusBadge("Pendiente de Cobro")}
                  </div>
                ) : isComercial && tramite.liquidez_status === "Adelantado" ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-500 text-center">
                      Estado actual de liquidez
                    </p>
                    {getStatusBadge("Pagado al Comercial")}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-500 text-center">
                      Estado actual de liquidez
                    </p>
                    {getStatusBadge(tramite.liquidez_status, "liquidez")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Action Buttons */}
      {hasActions ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">
            Acciones Disponibles
          </h4>
          <div className="flex items-center gap-3">
            {(isEditable || isBaja) && (
              <UpdateTramiteStatusModal
                tramite={tramite}
                userData={userData}
                onUpdate={onUpdate}
                client={client}
              />
            )}

            {isActive && !isComercial && (
              <RejectTramiteModal
                tramite={tramite}
                userData={userData}
                onSubmit={onUpdate}
              />
            )}

            {isRenewable && (isAdmin || isBackoffice) && (
              <RenewTramiteConfirmationDialog
                tramite={tramite}
                onRenew={onRenew}
                client={client}
              />
            )}
          </div>
        </div>
      ) : mode === "actions" ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-500">No hay acciones disponibles</p>
        </div>
      ) : null}
    </div>
  );
}
