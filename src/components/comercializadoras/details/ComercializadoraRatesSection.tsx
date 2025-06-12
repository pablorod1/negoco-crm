"use client";

import { Plus, TrendingUp, Calendar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/core/format";
import { Rate } from "@/lib/core/types";

interface ComercializadoraRatesSectionProps {
  rates: Rate[];
}

function RateCard({ tarifa }: { tarifa: Rate }) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/30">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                {tarifa.name}
              </h4>
              <p className="text-sm text-gray-500">{tarifa.type}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-blue-600">
                  {tarifa.price}
                </span>
                <span className="text-sm text-gray-500 font-medium">€/kWh</span>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Activa</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              <span>Creada: {formatDate(tarifa.created_at)}</span>
            </div>
            {tarifa.updated_at && (
              <div className="text-xs text-gray-500">
                Actualizada: {formatDate(tarifa.updated_at)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComercializadoraRatesSection({
  rates,
}: ComercializadoraRatesSectionProps) {
  return (
    <Card className="overflow-hidden bg-white shadow-lg border-0">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tarifas y Precios
          </CardTitle>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarifa
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {rates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
              <TrendingUp className="h-12 w-12 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              No hay tarifas creadas
            </h3>
            <p className="text-gray-500 mb-8 max-w-md">
              Crea tu primera tarifa para comenzar a gestionar los precios de
              esta comercializadora y ofrecer opciones competitivas a tus
              clientes.
            </p>
            <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-5 w-5" />
              Crear Primera Tarifa
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Tarifas Disponibles
                </h3>
                <p className="text-sm text-gray-500">
                  {rates.length} tarifa
                  {rates.length !== 1 ? "s" : ""} configurada
                  {rates.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rates.map((tarifa) => (
                <RateCard key={tarifa.id} tarifa={tarifa} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
