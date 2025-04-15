import { TramiteVM, User } from "@/lib/core/types";
import { Tooltip } from "@heroui/tooltip";
import { InfoIcon, RefreshCcw } from "lucide-react";
import UpdateTramiteStatusModal from "../UpdateTramiteStatusModal";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";

interface Props {
  tramite: TramiteVM;
  isComercial: boolean;
  userData: User;
  onUpdate: () => void;
}
export default function LiquidezStatusSection({
  tramite,
  isComercial,
  userData,
  onUpdate,
}: Props) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-primary-400">
              Estado de Liquidez
            </p>
            <Tooltip
              radius="sm"
              content={
                <div className="max-w-sm flex items-start gap-2">
                  <RefreshCcw className="size-6 text-primary-800" />
                  <div className="flex flex-col gap-1">
                    <h3 className=" font-semibold text-primary-800">
                      Actualización Automática
                    </h3>
                    <p className="text-primary-500">
                      El estado de liquidez cambiará automáticamente a{" "}
                      <strong>Pendiente de Cobro</strong> cuando el estado del
                      trámite cambie a <strong>Activo</strong>.
                    </p>
                  </div>
                </div>
              }
            >
              <InfoIcon className="size-3 text-gray-600" />
            </Tooltip>
          </div>
          {(tramite.status === "Activo" || tramite.status === "Baja") &&
            !isComercial && (
              <UpdateTramiteStatusModal
                tramite={tramite}
                userData={userData as User}
                onUpdate={onUpdate}
              />
            )}
        </div>
        {isComercial &&
        tramite.liquidez_status === "Cobrado por Comercializadora" ? (
          <>{getStatusBadge("Pendiente de Cobro")}</>
        ) : (
          <>{getStatusBadge(tramite.liquidez_status)}</>
        )}
      </div>
    </>
  );
}
