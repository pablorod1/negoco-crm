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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Información del Cliente
          </CardTitle>
          {!isComercial && !isCompleted && !isRejected ? (
            <TooltipComponent content="Editar Cliente">
              <EditFotovoltaicaDialog
                fotovoltaica={fotovoltaica}
                onSubmit={onSubmit}
                type="client"
                userData={userData}
              />
            </TooltipComponent>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">
            Cliente
          </Label>
          <p className="text-lg font-semibold">{fotovoltaica.client}</p>
        </div>
        <div className="grid grid-cols-2">
          <div className="flex flex-col items-start gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Tipo de Cliente
            </Label>
            <Badge variant="secondary" className="mt-1">
              {getClientTypeLabel}
            </Badge>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Tipo de Instalación
            </Label>
            <Badge variant="outline" className="mt-1">
              {getTypeLabel}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
