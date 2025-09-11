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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header Section - Minimalista */}
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border">
              <Building2 className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {comercializadora.name}
              </h1>
              <p className="text-gray-500">Comercializadora de Energía</p>
            </div>
          </div>
          {getEstadoBadge(comercializadora.active)}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Logo Section - Simplificado */}
          <div className="flex justify-center lg:justify-start lg:col-span-1">
            <div className="relative">
              <div className="w-32 h-32 bg-gray-50 rounded-lg p-4 border">
                <Image
                  src={`/companies/${comercializadora.logo}`}
                  alt="Logo Comercializadora"
                  width={256}
                  height={256}
                  className="object-contain w-full h-full"
                />
              </div>
              {comercializadora.active && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
          </div>

          {/* Stats Section - Minimalista */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Trámites */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {comercializadora.num_tramites}
                    </div>
                    <div className="text-sm text-gray-500 font-medium">
                      Trámites
                    </div>
                  </div>
                </div>
              </div>

              {/* Documentos */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center">
                    <FileText className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {comercializadora.num_files || 0}
                    </div>
                    <div className="text-sm text-gray-500 font-medium">
                      Documentos
                    </div>
                  </div>
                </div>
              </div>

              {/* Consumo Total */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center">
                    <Zap className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatConsumption(comercializadora.total_consumption)}
                    </div>
                    <div className="text-sm text-gray-500 font-medium">
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
