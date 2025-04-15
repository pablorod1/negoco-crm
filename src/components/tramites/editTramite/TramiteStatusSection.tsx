import { TramiteVM, User } from "@/lib/core/types";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import UpdateTramiteStatusModal from "./UpdateTramiteStatusModal";
import { Button } from "@heroui/button";
import RenewTramiteConfirmationDialog from "../RenewTramiteConfirmationDialog";
import { useState } from "react";
import AvatarComponent from "@/components/core/AvatarComponent";
import { formatDateTime } from "@/lib/core/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Clock, Info } from "lucide-react";

interface Props {
  tramite: TramiteVM;
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isRenewable: boolean;
  onRenew: () => void;
}

export default function TramiteStatusSection({
  tramite,
  userData,
  onUpdate,
  isEditable,
  isRenewable,
  onRenew,
}: Props) {
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const isAdmin = userData.role === "admin";
  const isBackoffice = userData.role === "1";
  return (
    <>
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-2">
          {getStatusBadge(tramite.status)}
          {isEditable && (
            <UpdateTramiteStatusModal
              tramite={tramite}
              userData={userData}
              onUpdate={onUpdate}
            />
          )}
          {isRenewable && (isAdmin || isBackoffice) && (
            <Button onPress={() => setIsRenewOpen(true)}>
              Renovar Trámite
            </Button>
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
      <RenewTramiteConfirmationDialog
        tramite={tramite}
        isOpen={isRenewOpen}
        onClose={() => setIsRenewOpen(false)}
        onRenew={onRenew}
      />
    </>
  );
}
