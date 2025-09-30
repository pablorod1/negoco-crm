import { ContractDB } from "@/tramites/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { MapPin, Building2, ArrowRight, Gauge, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { formatConsumption } from "@/core/utils/format";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";

interface ContractPreviewProps {
  contract: ContractDB;
}

export default function ContractPreview({ contract }: ContractPreviewProps) {
  // Check if any power values are set
  const hasPowerData = [
    contract.pot1,
    contract.pot2,
    contract.pot3,
    contract.pot4,
    contract.pot5,
    contract.pot6,
  ].some((pot) => pot > 0);

  // Filter out empty power values for display
  const activePowers = [
    { period: "P1", value: contract.pot1 },
    { period: "P2", value: contract.pot2 },
    { period: "P3", value: contract.pot3 },
    { period: "P4", value: contract.pot4 },
    { period: "P5", value: contract.pot5 },
    { period: "P6", value: contract.pot6 },
  ].filter((pot) => pot.value > 0);

  const { supplier: newSupplier, loading: newLoading } = useEnergySupplierById(
    contract.new_company
  );

  const { supplier: oldSupplier, loading: oldLoading } = useEnergySupplierById(
    contract.old_company || ""
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <Card>
        {/* Header with CUPS and company info */}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl font-bold text-gray-900 mb-1">
                {contract.CUPS}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-100"
                >
                  {contract.type}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs border-gray-200 text-gray-600"
                >
                  {contract.plan}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Content with all contract details */}
        <CardContent className="pt-6 space-y-6">
          {/* Company transition info */}
          <div className="flex items-center gap-6 w-full">
            <div className="space-y-3 w-full">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-600" />
                Cambio de Comercializadora
              </h3>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-500 mb-1">Compañía Actual</p>
                  <p className="text-sm font-medium text-gray-700">
                    {oldLoading
                      ? "Cargando..."
                      : oldSupplier?.name || "No especificada"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-500 mb-1">Nueva Compañía</p>
                  <p className="text-sm font-bold text-primary-700">
                    {newLoading
                      ? "Cargando..."
                      : newSupplier?.name || "No especificada"}
                  </p>
                </div>
              </div>
            </div>
            {/* Address information */}
            <div className="space-y-3 w-full">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-600" />
                Dirección del Suministro
              </h3>
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-gray-800">
                  {contract.address}
                </p>
                <p className="text-xs text-gray-600">
                  {contract.city}, {contract.province} • CP:{" "}
                  {contract.postal_code}
                </p>
              </div>
            </div>
          </div>

          {/* Consumption and Power data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Consumption */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-gray-600" />
                Consumo Anual
              </h4>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-bold text-blue-700">
                  {formatConsumption(contract.consumption)}
                </p>
                <p className="text-xs text-blue-600">kWh/año</p>
              </div>
            </div>

            {/* Power data */}
            {hasPowerData && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800">
                  Potencias Contratadas
                </h4>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {activePowers.map((power, index) => (
                      <div key={index} className="text-center">
                        <p className="text-green-600 font-medium">
                          {power.period}
                        </p>
                        <p className="text-green-800 font-bold">
                          {power.value} kW
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description if available */}
          {contract.description && contract.description.trim() && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                Descripción
              </h4>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {contract.description}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
