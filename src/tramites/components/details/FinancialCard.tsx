import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { TramiteDB } from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import TramiteComissionsSection from "@/tramites/components/editTramite/comissions/TramiteComissionsSection";
import { Badge } from "@/core/components/ui/badge";

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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
            Información Financiera
          </CardTitle>
          {tramite.plan ? (
            <CardDescription>
              <Badge className="capitalize">{tramite.plan}</Badge>
            </CardDescription>
          ) : null}
        </div>
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
