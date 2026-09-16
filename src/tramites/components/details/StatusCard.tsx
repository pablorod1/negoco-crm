import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import {
  TramiteVM,
  ClientDB,
  ContractDB,
  SignerDB,
} from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import TramiteStatusSection from "@/tramites/components/editTramite/TramiteStatusSection";

interface StatusCardProps {
  tramite: TramiteVM;
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isRenewable: boolean;
  client: ClientDB;
  contracts: ContractDB[];
  isActive: boolean;
  signer?: SignerDB | null;
}

export default function StatusCard({
  tramite,
  userData,
  onUpdate,
  isEditable,
  isRenewable,
  client,
  contracts,
  isActive,
  signer,
}: StatusCardProps) {
  const isComercial = userData.role === "2";
  const showLiquidez = isComercial && tramite.status === "Baja" ? false : true;
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <div className="size-2 bg-gray-600 rounded-full"></div>
          Estado del trámite
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
          contracts={contracts}
          isActive={isActive}
          showLiquidez={showLiquidez}
          signer={signer}
        />
      </CardContent>
    </Card>
  );
}
