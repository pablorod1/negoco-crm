import { memo } from "react";
import { Building2, ClipboardList, FileText, Zap } from "lucide-react";

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

  const stats = [
    {
      label: "Comercializadoras",
      value: comercializadoras.length.toString(),
      icon: Building2,
    },
    {
      label: "Trámites",
      value: totalTramites.toString(),
      icon: ClipboardList,
    },
    {
      label: "Documentos",
      value: totalFiles.toString(),
      icon: FileText,
    },
    {
      label: "Consumo Total",
      value: formatConsumption(totalConsumption),
      icon: Zap,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <stat.icon className="h-4 w-4 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 font-medium mb-1">
                {stat.label}
              </p>
              <p className="text-lg font-bold text-gray-900 truncate">
                {stat.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
