"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/core/format";
import { Rate } from "@/lib/core/types";

interface ComercializadoraRatesSectionProps {
  rates: Rate[];
}

function RateCard({ tarifa }: { tarifa: Rate }) {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold">{tarifa.name}</h4>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{tarifa.type}</p>
        <div className="space-y-2">
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-blue-600">
              {tarifa.price}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatDate(tarifa.created_at)}
            </span>
          </div>
          {tarifa.updated_at && (
            <p className="text-xs text-muted-foreground">
              Última actualización: {formatDate(tarifa.updated_at)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ComercializadoraRatesSection({
  rates,
}: ComercializadoraRatesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tarifas y Precios</CardTitle>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarifa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No hay tarifas creadas
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Crea tu primera tarifa para comenzar a gestionar los precios de
              esta comercializadora.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Tarifa
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rates.map((tarifa) => (
              <RateCard key={tarifa.id} tarifa={tarifa} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
