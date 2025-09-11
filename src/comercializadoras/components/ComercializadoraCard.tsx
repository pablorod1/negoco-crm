import { memo, useState } from "react";
import {
  Building2,
  ClipboardList,
  CloudAlert,
  FileText,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

import { ComercializadoraVM } from "@/comercializadoras/types/comercializadora.types";
import { User } from "@/core/types";
import { useTransitionRouter } from "next-view-transitions";
import { Switch } from "@/core/components/ui/switch";
import { showCustomToast } from "@/core/components/CustomToast";
import { formatConsumption } from "@/core/utils/format";

interface ComercializadoraCardProps {
  comercializadora: ComercializadoraVM;
  userData: User;
  refetch: () => void;
}

export const ComercializadoraCard = memo(function ComercializadoraCard({
  comercializadora,
  userData,
  refetch,
}: ComercializadoraCardProps) {
  const router = useTransitionRouter();
  const isComercial = userData.role === "2";

  const [isActive, setIsActive] = useState(comercializadora.active);

  const handleClick = () => {
    router.push(`/comercializadoras/${comercializadora.name}`);
  };

  const handleCheckChange = async (checked: boolean) => {
    const previousValue = isActive;
    setIsActive(checked);
    try {
      const response = await fetch(
        `/api/v2/energy-suppliers/${comercializadora.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: checked }),
        }
      );

      const { success, error } = await response.json();
      if (!success) {
        showCustomToast({
          title: "Error al actualizar estado",
          message:
            error || "No se pudo actualizar el estado de la comercializadora.",
          icon: CloudAlert,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        setIsActive(previousValue);
        return;
      }

      showCustomToast({
        title: "Estado actualizado",
        message: `La comercializadora ${comercializadora.name} ha sido ${checked ? "activada" : "desactivada"}.`,
        icon: checked ? ClipboardList : FileText,
        iconColor: checked ? "var(--success-color)" : "var(--warning-color)",
        iconSize: 24,
      });
      refetch();
    } catch (error) {
      console.error("Error updating status:", error);
      showCustomToast({
        title: "Error al actualizar estado",
        message:
          "Ocurrió un error al intentar actualizar el estado de la comercializadora.",
        icon: CloudAlert,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      setIsActive(previousValue);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {comercializadora.logo ? (
            <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              <Image
                src={`/companies/${comercializadora.logo}`}
                alt={`Logo de ${comercializadora.name}`}
                width={24}
                height={24}
                className="w-6 h-6 object-contain"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate text-sm">
              {comercializadora.name}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {!isComercial && (
            <div onClick={(e) => e.stopPropagation()}>
              <Switch checked={isActive} onCheckedChange={handleCheckChange} />
            </div>
          )}
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
      </div>

      {/* Main Metric */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Trámites</span>
          <span className="text-lg font-bold text-gray-900">
            {comercializadora.num_tramites}
          </span>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Documentos</p>
            <p className="text-sm font-semibold text-gray-700">
              {comercializadora.num_files || 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Consumo</p>
            <p className="text-sm font-semibold text-gray-700">
              {formatConsumption(comercializadora.total_consumption)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
