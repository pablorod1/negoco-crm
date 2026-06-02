"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { NumberTicker } from "@/core/components/ui/number-ticker";
import type { User } from "@/core/types";

interface MetricsData {
  conversionRatio: number;
  ticketMedio: number;
  comisionMediaPagada: number;
  renewalRatio: number;
  renewalByTariff: Record<string, number>;
}

interface MetricsViewProps {
  loading: boolean;
  userData: User;
}

export function MetricsView({ loading, userData }: MetricsViewProps) {
  const [data, setData] = useState<MetricsData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setFetching(true);
    setError(false);
    try {
      const res = await fetch("/api/v2/analytics/metrics");
      if (!res.ok) {
        setError(true);
        return;
      }
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (error) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No tienes permisos para ver las métricas</p>
      </div>
    );
  }

  const isLoading = loading || fetching;
  const kpis = data ?? {
    conversionRatio: 0,
    ticketMedio: 0,
    comisionMediaPagada: 0,
    renewalRatio: 0,
    renewalByTariff: {},
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Ratio de Conversión</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.conversionRatio * 100} decimalPlaces={1} endContent="%" />}
        </CardContent>
      </Card>

      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Ticket Medio</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.ticketMedio} decimalPlaces={2} endContent="€" />}
        </CardContent>
      </Card>

      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Comisión Media Pagada</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.comisionMediaPagada} decimalPlaces={2} endContent="€" />}
        </CardContent>
      </Card>

      <Card variant="dashboard">
        <CardHeader><CardTitle className="text-sm text-gray-500">Ratio de Renovación</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">
          {isLoading ? "—" : <NumberTicker value={kpis.renewalRatio * 100} decimalPlaces={1} endContent="%" />}
        </CardContent>
      </Card>

      <Card variant="dashboard" className="md:col-span-2 lg:col-span-4">
        <CardHeader><CardTitle className="text-sm text-gray-500">Renovaciones por Tarifa</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(kpis.renewalByTariff).length > 0
              ? Object.entries(kpis.renewalByTariff).map(([tariff, count]) => (
                  <div key={tariff} className="text-center">
                    <p className="text-lg font-semibold">{tariff}</p>
                    <p className="text-2xl font-bold text-primary-600">{count}</p>
                  </div>
                ))
              : <p className="text-gray-400">Sin datos</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
