import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { TramiteVM } from "@/tramites/types/tramite.types";
import { User } from "@/core/types";
import TramiteComercialSection from "@/tramites/components/editTramite/comercial/TramiteComercialSection";
import ProviderSection from "@/tramites/components/editTramite/ProviderSection";
import { isComercialUser } from "@/tramites/utils/permissions";

interface ComercialCardProps {
  tramite: TramiteVM;
  userData: User;
  onUpdate: () => void;
  isComercialEditable: boolean | null;
}

export default function ComercialCard({
  tramite,
  userData,
  onUpdate,
  isComercialEditable,
}: ComercialCardProps) {
  const isComercial = isComercialUser(userData.role);

  return (
    <Card className="border-gray-200 shadow-sm lg:col-span-1 xl:col-span-1">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
          Comercial y Proveedor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <TramiteComercialSection
          user={tramite.user as User}
          isEditable={isComercialEditable}
          userData={userData}
          tramite_id={tramite.id}
          onUpdate={onUpdate}
        />
        {!isComercial && (
          <ProviderSection tramite={tramite} onUpdate={onUpdate} />
        )}
      </CardContent>
    </Card>
  );
}
