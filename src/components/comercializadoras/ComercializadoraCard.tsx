import { memo } from "react";
import { Building2, ClipboardList, FileText } from "lucide-react";
import Image from "next/image";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComercializadoraVM } from "@/lib/core/types";
import { useTransitionRouter } from "next-view-transitions";

interface ComercializadoraCardProps {
  comercializadora: ComercializadoraVM;
}

export const ComercializadoraCard = memo(function ComercializadoraCard({
  comercializadora,
}: ComercializadoraCardProps) {
  const router = useTransitionRouter();

  const handleClick = () => {
    router.push(`/comercializadoras/${comercializadora.name}`);
  };
  return (
    <Card className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden bg-white border border-gray-200">
      {/* Background logo */}
      {comercializadora.logo && (
        <div className="absolute inset-0 opacity-5 group-hover:opacity-15 transition-opacity duration-300">
          <Image
            src={`/companies/${comercializadora.logo}`}
            alt={`Logo de ${comercializadora.name}`}
            width={300}
            height={300}
            className="w-full h-full object-contain scale-150"
            loading="lazy"
          />
        </div>
      )}

      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {/* Logo circle */}
            <div className="relative">
              {comercializadora.logo ? (
                <div className="w-12 h-12 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center overflow-hidden">
                  <Image
                    src={`/companies/${comercializadora.logo}`}
                    alt={`Logo de ${comercializadora.name}`}
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between w-full min-w-0">
              <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-primary transition-colors duration-200 truncate">
                {comercializadora.name}
              </h3>
              <Badge
                variant={comercializadora.active ? "default" : "secondary"}
                className={`text-xs font-medium ${
                  comercializadora.active
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {comercializadora.active ? "Activa" : "Inactiva"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 relative z-10">
        {/* Métricas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary-50/50 border border-primary-100 group-hover:bg-primary-50/90">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <ClipboardList className="h-4 w-4 text-primary-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Trámites
              </span>
            </div>
            <span className="font-bold text-lg text-primary-600">
              {comercializadora.num_tramites}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50/50 border border-green-100 group-hover:bg-green-50/90">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Documentos
              </span>
            </div>
            <span className="font-bold text-lg text-green-600">
              {comercializadora.num_files || 0}
            </span>
          </div>
        </div>

        <Button
          variant="primaryOutline"
          className="w-full mt-6"
          onClick={handleClick}
        >
          Ver Detalles
        </Button>
      </CardContent>
    </Card>
  );
});
