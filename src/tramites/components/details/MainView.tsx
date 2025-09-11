import { cn } from "@/core/utils";
import {
  ContractDB,
  TramiteVM,
  ClientDB,
} from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import StatusCard from "./StatusCard";
import ComercialCard from "./ComercialCard";
import FinancialCard from "./FinancialCard";
import ContractSection from "@/tramites/components/editTramite/contract/ContractSection";

interface MainViewProps {
  tramite: TramiteVM;
  client: ClientDB;
  contracts: ContractDB[];
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
  isComercialEditable: boolean | null;
  isRenewable: boolean;
  isActive: boolean;
  isSubcomercial: boolean;
}

export default function MainView({
  tramite,
  client,
  contracts,
  userData,
  onUpdate,
  isEditable,
  isComercialEditable,
  isRenewable,
  isActive,
  isSubcomercial,
}: MainViewProps) {
  return (
    <div className="space-y-6">
      {/* Status & Actions Cards Grid */}
      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          isSubcomercial ? "lg:grid-cols-1" : "lg:grid-cols-3"
        )}
      >
        {/* Status Card - Always visible */}
        <StatusCard
          tramite={tramite}
          userData={userData}
          onUpdate={onUpdate}
          isEditable={isEditable}
          isRenewable={isRenewable}
          client={client}
          isActive={isActive}
        />

        {/* Comercial & Provider Card - Hidden for subcomercial */}
        {!isSubcomercial && (
          <ComercialCard
            tramite={tramite}
            userData={userData}
            onUpdate={onUpdate}
            isComercialEditable={isComercialEditable}
          />
        )}

        {/* Financial Card - Hidden for subcomercial */}
        {!isSubcomercial && (
          <FinancialCard
            tramite={tramite}
            userData={userData}
            onUpdate={onUpdate}
            isEditable={isEditable}
          />
        )}
      </div>

      {/* Contract Section */}
      <ContractSection
        contracts={contracts}
        tramite_id={tramite.id}
        onContractUpdated={onUpdate}
        isEditable={isEditable}
        userData={userData}
      />
    </div>
  );
}
