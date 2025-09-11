import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { TramiteVM, ClientDB } from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import TramiteStatusSection from "@/tramites/components/editTramite/TramiteStatusSection";

interface StatusCardProps {
  tramite: TramiteVM;
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isRenewable: boolean;
  client: ClientDB;
  isActive: boolean;
}

export default function StatusCard({
  tramite,
  userData,
  onUpdate,
  isEditable,
  isRenewable,
  client,
  isActive,
}: StatusCardProps) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
          Estado del Trámite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TramiteStatusSection
          tramite={tramite}
          userData={userData}
          onUpdate={onUpdate}
          isEditable={isEditable}
          isRenewable={isRenewable}
          onRenew={onUpdate}
          client={client}
          isActive={isActive}
          showLiquidez={true}
        />
      </CardContent>
    </Card>
  );
}
