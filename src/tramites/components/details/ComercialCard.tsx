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
  embedded?: boolean;
  showProvider?: boolean;
}

export default function ComercialCard({
  tramite,
  userData,
  onUpdate,
  isComercialEditable,
  embedded = false,
  showProvider = true,
}: ComercialCardProps) {
  const isComercial = isComercialUser(userData.role);

  const content = (
    <>
      <CardHeader className={embedded ? "p-0 pb-3" : "pb-4"}>
        <CardTitle
          className={
            embedded
              ? "text-sm font-semibold text-gray-800 flex items-center gap-2"
              : "text-base font-semibold text-gray-800 flex items-center gap-2"
          }
        >
          <div className="size-2 bg-gray-600 rounded-full"></div>
          Comercial {!isComercial ? "y Proveedor" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className={embedded ? "space-y-3 p-0" : "space-y-4"}>
        <TramiteComercialSection
          user={tramite.user as User}
          isEditable={isComercialEditable}
          userData={userData}
          tramite_id={tramite.id}
          onUpdate={onUpdate}
        />
        {showProvider && !isComercial && (
          <ProviderSection tramite={tramite} onUpdate={onUpdate} />
        )}
      </CardContent>
    </>
  );

  if (embedded) {
    return <section className="space-y-3">{content}</section>;
  }

  return (
    <Card className=" lg:col-span-1 xl:col-span-1">
      {content}
    </Card>
  );
}
