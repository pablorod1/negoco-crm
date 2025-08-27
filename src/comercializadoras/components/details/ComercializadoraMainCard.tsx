"use client";

import { ComercializadoraDetails } from "@/comercializadoras/types";
import { Badge } from "@/core/components/ui/badge";
import { Building2, FileText, ClipboardList, Zap } from "lucide-react";
import Image from "next/image";
import { formatConsumption } from "@/core/utils/format";

interface ComercializadoraMainCardProps {
  comercializadora: ComercializadoraDetails;
}

const getEstadoBadge = (estado: boolean) => {
  return (
    <Badge
      variant={estado ? "success" : "destructive"}
      className="font-medium px-3 py-1 text-sm"
    >
      {estado ? "Activo" : "Inactivo"}
    </Badge>
  );
};

export function ComercializadoraMainCard({
  comercializadora,
}: ComercializadoraMainCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {comercializadora.name}
              </h1>
              <p className="text-primary-100">Comercializadora de Energía</p>
            </div>
          </div>
          {getEstadoBadge(comercializadora.active)}
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Logo Section */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative">
              <div className="w-48 h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 shadow-inner border">
                <Image
                  src={`/companies/${comercializadora.logo}`}
                  alt="Logo Comercializadora"
                  width={512}
                  height={512}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg"></div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="space-y-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Estadísticas Generales
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4 border border-primary-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary-700">
                      {comercializadora.num_tramites}
                    </div>
                    <div className="text-sm text-primary-600 font-medium">
                      Trámites
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-700">
                      {comercializadora.num_files || 0}
                    </div>
                    <div className="text-sm text-green-600 font-medium">
                      Documentos
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-orange-700">
                      {formatConsumption(comercializadora.total_consumption)}
                    </div>
                    <div className="text-sm text-orange-600 font-medium">
                      Consumo Total
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
