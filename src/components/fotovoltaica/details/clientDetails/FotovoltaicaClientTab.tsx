import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FotovoltaicaVM, User } from "@/lib/core/types";
import { Building } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import TooltipComponent from "@/components/core/TooltipComponent";
import EditFotovoltaicaDialog from "../EditFotovoltaicaDialog";
import { FOTOVOLTAICA_TYPES } from "@/lib/core/const";

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
              {fotovoltaica.client_type}
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
