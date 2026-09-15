"use client";

import { ComercializadoraDetails } from "@/comercializadoras/types";
import { Badge } from "@/core/components/ui/badge";
import { Building2, FileText, ClipboardList, Zap } from "lucide-react";
import Image from "next/image";
import { formatConsumption } from "@/core/utils/format";
import {
  companyLogoUrl,
  isUnoptimizedLogo,
} from "@/comercializadoras/lib/logo-url";

interface ComercializadoraHeaderCardProps {
  comercializadora: ComercializadoraDetails;
}

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}

function Stat({ icon: Icon, label, value }: StatProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-gray-50 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-200">
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xl font-bold text-gray-900">{value}</div>
        <div className="text-xs font-medium text-gray-500">{label}</div>
      </div>
    </div>
  );
}

/**
 * Cabecera fija del detalle: identidad de la comercializadora y sus métricas,
 * siempre visible por encima de las vistas de trámites y documentos.
 */
export function ComercializadoraHeaderCard({
  comercializadora,
}: ComercializadoraHeaderCardProps) {
  const logoUrl = companyLogoUrl(comercializadora.logo);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Identidad */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-gray-50 p-3">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`Logo de ${comercializadora.name}`}
                  width={160}
                  height={160}
                  className="size-full object-contain"
                  unoptimized={isUnoptimizedLogo(comercializadora.logo)}
                />
              ) : (
                <Building2 className="h-8 w-8 text-gray-400" />
              )}
            </div>
            {comercializadora.active && (
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-bold text-gray-900">
                {comercializadora.name}
              </h1>
              <Badge
                variant={comercializadora.active ? "success" : "destructive"}
                className="px-3 py-1 text-sm font-medium"
              >
                {comercializadora.active ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <p className="text-gray-500">Comercializadora de energía</p>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[32rem]">
          <Stat
            icon={ClipboardList}
            label="Trámites"
            value={comercializadora.num_tramites}
          />
          <Stat
            icon={FileText}
            label="Documentos"
            value={comercializadora.num_files || 0}
          />
          <Stat
            icon={Zap}
            label="Consumo total"
            value={formatConsumption(comercializadora.total_consumption)}
          />
        </div>
      </div>
    </div>
  );
}
