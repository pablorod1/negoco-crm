"use client";
import { ClientDB, TramiteVM, User } from "@/lib/core/types";
import { InfoIcon, RefreshCcw } from "lucide-react";
import UpdateTramiteStatusModal from "../UpdateTramiteStatusModal";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import TooltipComponent from "@/components/core/TooltipComponent";

interface Props {
  tramite: TramiteVM;
  isComercial: boolean;
  userData: User;
  onUpdate: () => void;
  client: ClientDB;
}
export default function LiquidezStatusSection({
  tramite,
  isComercial,
  userData,
  onUpdate,
  client,
}: Props) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-primary-400">
              Estado de Liquidez
            </p>
            <TooltipComponent
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
              color="bg-white shadow"
            >
              <InfoIcon className="size-3 text-gray-600" />
            </TooltipComponent>
          </div>
          {(tramite.status === "Activo" || tramite.status === "Baja") &&
            !isComercial && (
              <UpdateTramiteStatusModal
                tramite={tramite}
                userData={userData as User}
                onUpdate={onUpdate}
                client={client}
              />
            )}
        </div>
        {isComercial &&
        tramite.liquidez_status === "Cobrado por Comercializadora" ? (
          <>{getStatusBadge("Pendiente de Cobro")}</>
        ) : (
          <>{getStatusBadge(tramite.liquidez_status, "liquidez")}</>
        )}
      </div>
    </>
  );
}
