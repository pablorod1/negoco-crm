import { User } from "@/core/types";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import UpdateTramiteStatusModal from "./UpdateTramiteStatusModal";
import RenewTramiteConfirmationDialog from "../RenewTramiteConfirmationDialog";
import RejectTramiteModal from "./RejectTramiteModal";
import { ClientDB, TramiteVM } from "@/tramites/types";
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
}: Props) {
  const isAdmin = userData.role === "admin";
  const isBackoffice = userData.role === "1";
  const isComercial = userData.role === "2";
  const isBaja = tramite.status === "Baja";

  return (
    <div className="space-y-6 ">
      <div className="grid 2xl:grid-cols-2 gap-6">
        {/* Current Status Display */}
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">Estado Actual</div>
          <div className="flex items-center gap-2">
            {getStatusBadge(tramite.status, "general")}
          </div>
        </div>

        {/* Liquidez Status Section */}
        {showLiquidez && (
          <div className="flex justify-center items-center bg-gray-50 rounded-2xl p-4 border border-gray-200 relative">
            <div className="absolute top-4 right-4">
              <TooltipComponent
                content={
                  <div className="max-w-sm p-4">
                    <div className="flex items-start gap-3">
                      <RefreshCcw className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
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
                <InfoIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
              </TooltipComponent>
            </div>
            <div className="flex items-center justify-center">
              {isComercial &&
              tramite.liquidez_status === "Cobrado por Comercializadora" ? (
                <div className="flex flex-col items-center space-y-2">
                  <p className="text-xs text-gray-500 text-center">
                    Estado actual de liquidez
                  </p>
                  {getStatusBadge("Pendiente de Cobro")}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
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

      {/* Action Buttons */}
      {(isEditable ||
        isBaja ||
        (isActive && !isComercial) ||
        (isRenewable && (isAdmin || isBackoffice)) ||
        (showLiquidez &&
          (tramite.status === "Activo" || tramite.status === "Baja") &&
          !isComercial)) && (
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
      )}
    </div>
  );
}
