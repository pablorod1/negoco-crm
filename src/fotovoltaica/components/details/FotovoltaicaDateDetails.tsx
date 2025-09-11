import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/core/components/ui/card";
import { Calendar } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import { formatDateTime } from "@/core/utils/format";
import { FotovoltaicaVM } from "@/fotovoltaica/types";

interface Props {
  fotovoltaica: FotovoltaicaVM;
}

export default function FotovoltaicaDateDetails({ fotovoltaica }: Props) {
  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          Fechas Importantes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fecha de Creación */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Fecha de Creación
          </Label>
          <p className="text-sm font-medium text-gray-900">
            {formatDateTime(fotovoltaica.creation_date)}
          </p>
        </div>

        {/* Fecha de Activación */}
        {fotovoltaica.activation_date && (
          <div className="space-y-2">
            <Label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Fecha de Activación
            </Label>
            <p className="text-sm font-medium text-gray-900">
              {formatDateTime(fotovoltaica.activation_date)}
            </p>
          </div>
        )}

        {/* Última Actualización */}
        {fotovoltaica.updated_at && (
          <div className="space-y-2">
            <Label className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Última Actualización
            </Label>
            <p className="text-sm font-medium text-gray-900">
              {formatDateTime(fotovoltaica.updated_at)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
