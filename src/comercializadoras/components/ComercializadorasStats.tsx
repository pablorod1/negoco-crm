import { memo } from "react";
import { Building2, ClipboardList, FileText, Zap } from "lucide-react";

import { Card, CardContent } from "@/core/components/ui/card";
import { ComercializadoraVM } from "../types";
import { formatConsumption } from "@/core/utils/format";

interface ComercializadorasStatsProps {
  comercializadoras: ComercializadoraVM[];
}

export const ComercializadorasStats = memo(function ComercializadorasStats({
  comercializadoras,
}: ComercializadorasStatsProps) {
  const totalTramites = comercializadoras.reduce(
    (sum, c) => sum + c.num_tramites,
    0
  );
  const totalFiles = comercializadoras.reduce((sum, c) => sum + c.num_files, 0);
  const totalConsumption = comercializadoras.reduce(
    (sum, c) => sum + c.total_consumption,
    0
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">
                Total Comercializadoras
              </p>
              <p className="text-2xl font-bold">{comercializadoras.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Trámites</p>
              <p className="text-2xl font-bold">{totalTramites}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Documentos</p>
              <p className="text-2xl font-bold">{totalFiles}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-sm text-muted-foreground">Consumo Total</p>
              <p className="text-2xl font-bold">
                {formatConsumption(totalConsumption)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
