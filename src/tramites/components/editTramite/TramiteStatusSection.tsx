import { User } from "@/core/types";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import UpdateTramiteStatusModal from "./UpdateTramiteStatusModal";
import { Button } from "@/core/components/ui/button";
import RenewTramiteConfirmationDialog from "../RenewTramiteConfirmationDialog";
import AvatarComponent from "@/core/components/AvatarComponent";
import { formatDateTime } from "@/core/utils/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { Clock, Info } from "lucide-react";
import RejectTramiteModal from "./RejectTramiteModal";
import { ClientDB, TramiteVM } from "@/tramites/types";

interface Props {
  tramite: TramiteVM;
  client: ClientDB;
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isRenewable: boolean;
  onRenew: () => void;
  isActive: boolean;
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
}: Props) {
  const isAdmin = userData.role === "admin";
  const isBackoffice = userData.role === "1";
  const isComercial = userData.role === "2";
  const isBaja = tramite.status === "Baja";
  return (
    <>
      <div className="flex flex-col gap-2 items-end">
        <div className="flex items-center gap-2">
          {getStatusBadge(tramite.status, "general")}
          {isEditable || isBaja ? (
            <UpdateTramiteStatusModal
              tramite={tramite}
              userData={userData}
              onUpdate={onUpdate}
              client={client}
            />
          ) : null}
          {isActive && !isComercial ? (
            <RejectTramiteModal
              tramite={tramite}
              userData={userData}
              onSubmit={onUpdate}
            />
          ) : null}

          {isRenewable && (isAdmin || isBackoffice) && (
            <RenewTramiteConfirmationDialog
              tramite={tramite}
              onRenew={onRenew}
              client={client}
            />
          )}
        </div>
        {tramite.updated_by && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">Última actualización</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Información de actualización
                </h4>

                <div className="flex items-start gap-3 pt-2">
                  <AvatarComponent userData={tramite.updated_by} />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">
                      {tramite.updated_by.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tramite.updated_by.email}
                    </span>
                    <span className="text-xs mt-1">
                      {formatDateTime(tramite.updated_at as string)}
                    </span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </>
  );
}
