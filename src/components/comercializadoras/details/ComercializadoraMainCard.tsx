"use client";

import { Badge } from "@/components/ui/badge";
import { ComercializadoraDetails } from "@/lib/core/types";
import Image from "next/image";

interface ComercializadoraMainCardProps {
  comercializadora: ComercializadoraDetails;
}

const getEstadoBadge = (estado: boolean) => {
  return (
    <Badge variant={estado ? "success" : "destructive"} className="font-medium">
      {estado ? "Activo" : "Inactivo"}
    </Badge>
  );
};

export function ComercializadoraMainCard({
  comercializadora,
}: ComercializadoraMainCardProps) {
  return (
    <div className="bg-white rounded-lg p-8 w-full mb-24">
      <div className="flex items-center justify-between gap-8 w-full relative">
        {/* Logo */}
        <Image
          src={`/companies/${comercializadora.logo}`}
          alt="Logo Comercializadora"
          width={512}
          height={512}
          className="object-contain w-64 h-64 absolute left-8 top-1/2 transform -translate-y-1/2"
        />

        {/* Company info */}
        <div className="flex flex-col justify-end items-end gap-4 w-full">
          <div className="flex items-center gap-4 mb-4">
            {getEstadoBadge(comercializadora.active)}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-semibold text-gray-900">
                {comercializadora.num_tramites}
              </div>
              <div className="text-sm text-gray-500">Trámites</div>
            </div>
            <div className="w-px h-10 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">
                {comercializadora.num_files || 0}
              </div>
              <div className="text-sm text-gray-500">Documentos</div>
            </div>
            {/* <div className="w-px h-10 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">
                {comercializadora.rates?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Tarifas</div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
