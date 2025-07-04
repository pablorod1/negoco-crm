import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/core/components/ui/card";
import { User } from "@/core/types";
import { DollarSign } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import { formatComission } from "@/core/utils/format";
import EditFotovoltaicaDialog from "../EditFotovoltaicaDialog";
import { FotovoltaicaVM } from "@/fotovoltaica/types";

interface Props {
  fotovoltaica: FotovoltaicaVM;
  isComercial: boolean;
  onSubmit: () => void;
  userData: User;
}

export default function FotovoltaicaComisionsDetailsTab({
  fotovoltaica,
  isComercial,
  onSubmit,
  userData,
}: Props) {
  const isCompleted = fotovoltaica.status === "completed";
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Información Financiera
          </CardTitle>
          {!isComercial && isCompleted ? (
            <EditFotovoltaicaDialog
              type="comision"
              fotovoltaica={fotovoltaica}
              onSubmit={onSubmit}
              userData={userData}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isComercial ? (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Comisión
            </Label>
            <p className="text-2xl font-bold text-green-600">
              {formatComission(fotovoltaica.comision)}
            </p>
          </div>
        ) : null}
        <div>
          <Label className="text-sm font-medium text-muted-foreground">
            Comisión Comercial
          </Label>
          <p className="text-lg font-semibold">
            {formatComission(fotovoltaica.comision_sales_person)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
