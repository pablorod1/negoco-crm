import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FotovoltaicaVM } from "@/lib/core/types";
import { CalendarDays } from "lucide-react";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/core/format";

interface Props {
  fotovoltaica: FotovoltaicaVM;
}

export default function FotovoltaicaDateDetails({ fotovoltaica }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Fechas Importantes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">
            Fecha de Creación
          </Label>
          <p className="font-medium">
            {formatDate(fotovoltaica.creation_date)}
          </p>
        </div>
        {fotovoltaica.activation_date && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Fecha de Activación
            </Label>
            <p className="font-medium">
              {formatDate(fotovoltaica.activation_date)}
            </p>
          </div>
        )}
        {fotovoltaica.updated_at && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Última Actualización
            </Label>
            <p className="font-medium">{formatDate(fotovoltaica.updated_at)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
