import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/core/components/ui/card";
import { FotovoltaicaVM } from "@/fotovoltaica/types";
import { User } from "@/core/types";
import { Building } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import { Badge } from "@/core/components/ui/badge";
import TooltipComponent from "@/core/components/TooltipComponent";
import EditFotovoltaicaDialog from "../EditFotovoltaicaDialog";
import {
  FOTOVOLTAICA_CLIENT_TYPES,
  FOTOVOLTAICA_TYPES,
} from "@/fotovoltaica/constants";

export default function FotovoltaicaClientTab({
  fotovoltaica,
  onSubmit,
  isComercial,
  userData,
}: {
  fotovoltaica: FotovoltaicaVM;
  onSubmit: () => void;
  isComercial: boolean;
  userData: User;
}) {
  const isCompleted = fotovoltaica.status === "completed";
  const isRejected = fotovoltaica.status === "rejected";

  const getTypeLabel =
    FOTOVOLTAICA_TYPES.find(
      (fotovoltaicaType) => fotovoltaicaType.value === fotovoltaica.type
    )?.label || "No especificado";

  const getClientTypeLabel =
    FOTOVOLTAICA_CLIENT_TYPES.find(
      (clientType) => clientType.value === fotovoltaica.client_type
    )?.label || "No especificado";

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building className="h-5 w-5 text-gray-600" />
            Información del Cliente
          </CardTitle>
          {!isComercial && !isCompleted && !isRejected && (
            <TooltipComponent content="Editar información del cliente">
              <EditFotovoltaicaDialog
                fotovoltaica={fotovoltaica}
                onSubmit={onSubmit}
                type="client"
                userData={userData}
              />
            </TooltipComponent>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Cliente
          </Label>
          <p className="text-sm font-medium text-gray-900">
            {fotovoltaica.client}
          </p>
        </div>

        {/* Tipo de Cliente */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Tipo de Cliente
          </Label>
          <Badge variant="secondary" className="text-xs">
            {getClientTypeLabel}
          </Badge>
        </div>

        {/* Tipo de Instalación */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Tipo de Instalación
          </Label>
          <Badge variant="outline" className="text-xs">
            {getTypeLabel}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
