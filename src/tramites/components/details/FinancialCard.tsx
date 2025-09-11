import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { TramiteDB } from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import TramiteComissionsSection from "@/tramites/components/editTramite/comissions/TramiteComissionsSection";

interface FinancialCardProps {
  tramite: TramiteDB;
  userData: User;
  onUpdate: () => void;
  isEditable: boolean | null;
}

export default function FinancialCard({
  tramite,
  userData,
  onUpdate,
  isEditable,
}: FinancialCardProps) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
          Información Financiera
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TramiteComissionsSection
          tramite={tramite}
          userData={userData}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      </CardContent>
    </Card>
  );
}
